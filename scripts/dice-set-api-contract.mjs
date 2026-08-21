import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) { if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`); }

try {
  const [saveApi, libraryApi, cloudRules, imageApi, storeLayer] = await Promise.all([
    read('netlify/functions/save-dice-set.mjs'), read('netlify/functions/dice-sets.mjs'),
    read('js/appearance/cloud-rules.mjs'), read('netlify/functions/dice-set-image.mjs'),
    read('netlify/functions/dice-set-store.mjs'),
  ]);
  [
    'const user = await getUser()', 'if (!user)', 'const rawSet = structuredClone',
    'extractTrayImageDataUrl', 'prepareCloudDiceSet(rawSet, user.id)',
    'assertLockedUpdateAllowed(existing.set, set)', "set.visibility === 'public' && set.locked",
    'trayImageAccessToken', 'MAX_TRAY_IMAGE_BYTES', "|| 'Adventurer'", 'openDiceSetStore()',
    'publicRecordKey(user.id, set.id)', 'toPublicRecord(record)', 'if (!publicLocked) await store.delete(publicKey)',
  ].forEach((text) => requireText(saveApi, text, 'save API protection'));
  if (saveApi.includes('user.email')) throw new Error('Public dice-set creator metadata must never fall back to account email.');
  if (/COMMUNITY_INDEX|indexKey\(|setJSON\([^\n]*index/i.test(saveApi)) throw new Error('Save API must not write shared dice-set index blobs.');
  [
    'const user = await getUser()', "scope === 'community'", 'listPublicRecords(store)',
    'loadLegacyCommunityRecords(store)', 'listUserRecords(store, user.id)',
    'ownerId !== user.id && !publicLocked', 'publicRecordKey(user.id, setId)', 'toPublicRecord(record)',
  ].forEach((text) => requireText(libraryApi, text, 'library API protection'));
  if (/setJSON\([^\n]*index/i.test(libraryApi)) throw new Error('Library API must not write shared dice-set index blobs.');
  ['set.ownerId = userId', "set.id === SYSTEM_DEFAULT_DICE_SET_ID", 'MAX_CLOUD_SET_BYTES', 'Unlock the dice set before changing its name or appearance.']
    .forEach((text) => requireText(cloudRules, text, 'cloud rule'));
  [
    "path: '/api/dice-set-image'", "const publicLocked = record.set?.visibility === 'public' && record.set?.locked",
    'const hasCapability = publicLocked', 'user.id !== ownerId', "'Cache-Control': 'no-store'", 'openDiceSetStore()', 'X-Content-Type-Options',
  ].forEach((text) => requireText(imageApi, text, 'tray image API protection'));
  if (/max-age|public,\s*max-age|private,\s*max-age/.test(imageApi)) throw new Error('Capability-scoped tray images must not remain cacheable after visibility changes.');
  [
    "getStore({ name: STORE_NAME, consistency: 'strong' })", "PUBLIC_DICE_SET_PREFIX = 'community/public-dice-sets/'",
    'LEGACY_COMMUNITY_INDEX', 'store.list({ prefix })', 'listUserRecords', 'listPublicRecords', 'publicRecordKey', 'toPublicRecord',
  ].forEach((text) => requireText(storeLayer, text, 'strong per-record storage contract'));
  console.log('Dice-set API contract passed: strong-consistency ownership, no shared-index writes, per-set public projections, legacy community reads, public privacy boundary, immediate capability revocation, and no-store tray images.');
} catch (error) {
  console.error('Dice-set API contract failed:', error);
  process.exitCode = 1;
}
