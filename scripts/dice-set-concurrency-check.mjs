import assert from 'node:assert/strict';
import {
  conditionalRecordWrite, listVersionedUserRecords, normalizeExpectedVersion, readVersionedRecord,
} from '../netlify/functions/dice-set-concurrency.mjs';
import { recordKey } from '../netlify/functions/dice-set-store.mjs';

class FakeStore {
  constructor() { this.entries = new Map(); this.counter = 0; this.beforeSet = null; }
  nextEtag() { this.counter += 1; return `"v${this.counter}"`; }
  async getWithMetadata(key) {
    const entry = this.entries.get(key);
    return entry ? { data: structuredClone(entry.data), etag: entry.etag } : null;
  }
  async list({ prefix }) {
    return { blobs: [...this.entries.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, etag: value.etag })) };
  }
  async setJSON(key, data, options = {}) {
    if (this.beforeSet) { const callback = this.beforeSet; this.beforeSet = null; await callback(this, key); }
    const current = this.entries.get(key);
    if (options.onlyIfNew && current) return { modified: false };
    if (options.onlyIfMatch && current?.etag !== options.onlyIfMatch) return { modified: false };
    if (options.onlyIfMatch && !current) return { modified: false };
    const etag = this.nextEtag();
    this.entries.set(key, { data: structuredClone(data), etag });
    return { modified: true, etag };
  }
}

const store = new FakeStore();
const key = recordKey('user-1', 'set-1');
const first = { set: { id: 'set-1' }, updatedAt: 'first' };
const created = await conditionalRecordWrite(store, key, first, null);
assert.equal(created.conflict, undefined);
assert.equal(created.version, '"v1"');
assert.deepEqual((await readVersionedRecord(store, key)).record, first);

const staleCreate = await conditionalRecordWrite(store, key, { set: { id: 'set-1' }, updatedAt: 'stale' }, null);
assert.equal(staleCreate.conflict?.code, 'dice-set-version-conflict');
assert.equal(staleCreate.conflict?.version, '"v1"');
assert.equal(staleCreate.conflict?.record?.updatedAt, 'first');

const second = { set: { id: 'set-1' }, updatedAt: 'second' };
const updated = await conditionalRecordWrite(store, key, second, '"v1"');
assert.equal(updated.version, '"v2"');

store.beforeSet = async (fake, targetKey) => {
  fake.entries.set(targetKey, { data: { set: { id: 'set-1' }, updatedAt: 'other-device' }, etag: '"external"' });
};
const raced = await conditionalRecordWrite(store, key, { set: { id: 'set-1' }, updatedAt: 'loser' }, '"v2"');
assert.equal(raced.conflict?.code, 'dice-set-version-conflict');
assert.equal(raced.conflict?.version, '"external"');
assert.equal(raced.conflict?.record?.updatedAt, 'other-device');

const key2 = recordKey('user-1', 'set-2');
await conditionalRecordWrite(store, key2, { set: { id: 'set-2' }, updatedAt: 'two' }, null);
const listed = await listVersionedUserRecords(store, 'user-1');
assert.deepEqual(new Set(listed.map((entry) => entry.record.set.id)), new Set(['set-1', 'set-2']));
assert.throws(() => normalizeExpectedVersion(''), /version/i);
assert.throws(() => normalizeExpectedVersion(7), /version/i);
assert.equal(normalizeExpectedVersion(null), null);
assert.equal(normalizeExpectedVersion('"etag"'), '"etag"');

console.log('Dice-set concurrency passed: create/update races fail closed, latest server state is returned, strong versioned reads work, and stale writers cannot overwrite a winner.');
