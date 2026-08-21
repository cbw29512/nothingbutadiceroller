import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { lockDiceSet } from '../js/appearance/transitions.mjs';
import { buildBrowserImportSet, getImportableBrowserSets, importBrowserSets } from '../js/appearance/studio-browser-import.mjs';

const browserOwner = 'local_browser';
const cloudOwner = 'account_user';
const alpha = createUserDiceSet({ id: 'set_alpha', ownerId: browserOwner, name: 'Alpha' });
let beta = createUserDiceSet({ id: 'set_beta', ownerId: browserOwner, name: 'Beta' });
beta = lockDiceSet(beta, browserOwner);
const cloudBeta = createUserDiceSet({ id: 'set_beta', ownerId: cloudOwner, name: 'Already Imported' });

assert.deepEqual(getImportableBrowserSets([alpha, beta], [cloudBeta]).map((set) => set.id), ['set_alpha']);
const prepared = buildBrowserImportSet(beta, cloudOwner);
assert.equal(prepared.id, beta.id, 'Import must keep the stable set id for idempotency.');
assert.equal(prepared.ownerId, cloudOwner, 'Import must transfer the copy to the signed-in account.');
assert.equal(prepared.name, beta.name);
assert.deepEqual(prepared.appearance, beta.appearance, 'Import must preserve the visual design exactly.');
assert.equal(prepared.locked, false, 'Imported browser copies start editable.');
assert.equal(prepared.visibility, 'private', 'Imported browser copies start private.');

const gamma = createUserDiceSet({ id: 'set_gamma', ownerId: browserOwner, name: 'Gamma' });
let inFlight = 0;
let maxInFlight = 0;
const calls = [];
const success = await importBrowserSets({
  browserSets: [alpha, gamma], cloudSets: [], userId: cloudOwner,
  saveSet: async (set) => {
    inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight); calls.push(set.id);
    await Promise.resolve(); inFlight -= 1; return set;
  },
});
assert.deepEqual(calls, ['set_alpha', 'set_gamma']);
assert.equal(maxInFlight, 1, 'Cloud imports must save sequentially to avoid shared-index write races.');
assert.equal(success.imported.length, 2);
assert.equal(success.pending.length, 0);

const partial = await importBrowserSets({
  browserSets: [alpha, gamma], cloudSets: [], userId: cloudOwner,
  saveSet: async (set) => {
    if (set.id === 'set_gamma') throw new Error('simulated save failure');
    return set;
  },
});
assert.deepEqual(partial.imported.map((set) => set.id), ['set_alpha']);
assert.deepEqual(partial.pending.map((set) => set.id), ['set_gamma']);
assert.equal(partial.failures.length, 1, 'Failed imports must stay retryable instead of disappearing.');

const [studio, bindings, render, html] = await Promise.all([
  readFile(new URL('../js/appearance/studio.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/appearance/studio-bindings.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../js/appearance/studio-render.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../customize.html', import.meta.url), 'utf8'),
]);
for (const text of ['browserSavedSets', 'getImportableBrowserSets(browserSavedSets, savedSets)', 'importBrowserCollection', 'setActiveDiceSet(active)', 'renderStorageMode(cloudEnabled, importableBrowserSets.length)']) {
  assert.ok(studio.includes(text), `Studio browser-import integration missing: ${text}`);
}
assert.ok(bindings.includes("q('import-browser-sets').addEventListener('click', actions.importBrowserCollection)"));
assert.ok(render.includes('export function renderStorageMode') && render.includes('sets sync to your account'), 'Storage status must refresh after imports complete.');
assert.ok(html.includes('id="import-browser-sets"') && html.includes('hidden>Import Browser Sets'));
console.log('Studio browser import passed: guest designs remain discoverable, account imports are private/editable/idempotent, sequential saves avoid index races, failures remain retryable, active-set continuity is protected, and storage status stays accurate.');
