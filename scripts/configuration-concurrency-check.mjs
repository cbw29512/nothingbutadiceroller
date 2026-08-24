import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { apiErrorResponse, publicError } from '../netlify/functions/api-errors.mjs';
import {
  normalizeConfigurationVersion, readVersionedConfigurations, writeVersionedConfigurations,
} from '../netlify/functions/configuration-concurrency.mjs';

class FakeStore {
  constructor() { this.entry = null; this.counter = 0; this.beforeSet = null; }
  nextEtag() { this.counter += 1; return `"cfg-${this.counter}"`; }
  async getWithMetadata() {
    return this.entry ? { data: structuredClone(this.entry.data), etag: this.entry.etag } : null;
  }
  async setJSON(_key, data, options = {}) {
    if (this.beforeSet) { const callback = this.beforeSet; this.beforeSet = null; await callback(this); }
    if (options.onlyIfNew && this.entry) return { modified: false };
    if (options.onlyIfMatch && this.entry?.etag !== options.onlyIfMatch) return { modified: false };
    if (options.onlyIfMatch && !this.entry) return { modified: false };
    const etag = this.nextEtag(); this.entry = { data: structuredClone(data), etag }; return { modified: true, etag };
  }
}

const project = (items) => items.map((item) => ({ id: String(item.id || ''), name: String(item.name || '') }));
const store = new FakeStore();
assert.deepEqual(await readVersionedConfigurations(store, 'key'), { configurations: [], version: null });

const initial = [{ id: 'a', name: 'First' }];
assert.equal(await writeVersionedConfigurations(store, 'key', initial, null, { project }), '"cfg-1"');

await assert.rejects(
  writeVersionedConfigurations(store, 'key', [{ id: 'b', name: 'Stale create' }], null, { project }),
  (error) => error.code === 'configuration-version-conflict'
    && error.status === 409
    && error.details.version === '"cfg-1"'
    && error.details.configurations[0].name === 'First',
);

assert.equal(
  await writeVersionedConfigurations(store, 'key', [{ id: 'a', name: 'Second' }], '"cfg-1"', { project }),
  '"cfg-2"',
);
store.beforeSet = async (fake) => {
  fake.entry = { data: [{ id: 'a', name: 'Other device', secret: 'must-not-leak' }], etag: '"external"' };
};
await assert.rejects(
  writeVersionedConfigurations(store, 'key', [{ id: 'a', name: 'Loser' }], '"cfg-2"', { project }),
  (error) => error.code === 'configuration-version-conflict'
    && error.details.version === '"external"'
    && error.details.configurations[0].name === 'Other device'
    && !('secret' in error.details.configurations[0]),
);

assert.equal(normalizeConfigurationVersion(null), null);
assert.equal(normalizeConfigurationVersion('"etag"'), '"etag"');
assert.throws(() => normalizeConfigurationVersion(''), /version/i);
assert.throws(() => normalizeConfigurationVersion(42), /version/i);

const safeValidation = apiErrorResponse(publicError('Safe validation.', { status: 422, code: 'safe' }), 'Fallback.');
assert.deepEqual(safeValidation, { status: 422, body: { error: 'Safe validation.', code: 'safe' } });
const internal = apiErrorResponse(new Error('SECRET_STORAGE_DETAIL'), 'Configuration request failed.');
assert.equal(internal.status, 500);
assert.equal(internal.body.error, 'Configuration request failed.');
assert.ok(!JSON.stringify(internal).includes('SECRET_STORAGE_DETAIL'));

const [server, account, api] = await Promise.all([
  readFile(new URL('../netlify/functions/configurations.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../js/account.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/account-api.js', import.meta.url), 'utf8'),
]);
for (const text of [
  'readVersionedConfigurations(store, key)', 'writeVersionedConfigurations(store, key',
  "request.headers.get('If-Match')", 'configurationConflict(snapshot, projectConfigurations)',
  "apiErrorResponse(error, 'Configuration request failed.')",
]) assert.ok(server.includes(text), `Configuration server contract missing: ${text}`);
for (const text of [
  'let configurationVersion = null', 'version: configurationVersion',
  "'If-Match': configurationVersion", "error?.code !== 'configuration-version-conflict'",
  'your current dice are unchanged',
]) assert.ok(account.includes(text), `Account configuration conflict contract missing: ${text}`);
for (const text of ['error.code = data.code || null', 'error.details = data.details || null', 'error.status = response.status']) {
  assert.ok(api.includes(text), `Account API structured error contract missing: ${text}`);
}
assert.ok(!server.includes("return json({ error: error?.message"), 'Configuration API must not echo arbitrary exception messages.');

console.log('Saved-configuration concurrency passed: atomic ETag writes reject stale/racing sessions, conflict payloads are sanitized, clients preserve structured 409s, and internal errors stay server-side.');
