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
    'const user = await getUser()', 'if (!user)', 'verifyRequestOrigin(request)', 'const rawSet = structuredClone',
    'extractTrayImageDataUrl', 'prepareCloudDiceSet(rawSet, user.id)',
    'assertLockedUpdateAllowed(existing.set, set)', "set.visibility === 'public' && set.locked",
    'trayImageAccessToken', 'MAX_TRAY_IMAGE_BYTES', "|| 'Adventurer'", 'openDiceSetStore(context)',
    'newPublicAccessId()', 'buildPublicProjection(record, publicAccessId)',
    'countUserRecords(store, user.id) >= MAX_USER_DICE_SETS', 'Post-save dice-set quota verification failed; rolling back new set:',
    'versionedImageKey(user.id, set.id, trayImageAccessToken)', 'previousTrayImageKey',
    'stagedTrayImageKey', 'stagedPublicKey', 'stagedPublicWasNew',
    'bestEffortDelete(store, previousTrayImageKey', 'bestEffortDelete(store, publicRecordKey(previousPublicAccessId)',
    'Tray images must be uploaded through Dice Studio.', 'const rawTray = rawSet?.appearance?.tray;',
    'rawTray.image = ownerImage(user.id, rawSet.id, existing.trayImageAccessToken)',
    'The save was rolled back; retry.', "Request origin is not allowed.",
  ].forEach((text) => requireText(saveApi, text, 'save API protection'));
  const projectionStage = saveApi.indexOf('await store.setJSON(stagedPublicKey, buildPublicProjection(record, publicAccessId));');
  const recordWrite = saveApi.indexOf('await store.setJSON(key, record);');
  const previousPublicCleanup = saveApi.indexOf("bestEffortDelete(store, publicRecordKey(previousPublicAccessId), 'previous public projection')");
  const previousImageCleanup = saveApi.indexOf("bestEffortDelete(store, previousTrayImageKey, 'previous tray image')");
  if (projectionStage < 0 || recordWrite <= projectionStage) throw new Error('Public projection must be staged before the authoritative owner record commit.');
  if (previousPublicCleanup <= recordWrite || previousImageCleanup <= recordWrite) throw new Error('Previous public/image blobs must be cleaned only after the owner record commits.');
  if (saveApi.includes('user.email')) throw new Error('Dice-set creator metadata must never fall back to account email.');
  if (/COMMUNITY_INDEX|indexKey\(|setJSON\([^\n]*index/i.test(saveApi)) throw new Error('Save API must not write shared dice-set index blobs.');

  [
    'const user = await getUser()', "scope === 'community'", 'listPublicProjections(store)',
    'listLegacyPublicProjections(store, sources)', 'listUserRecords(store, user.id)',
    'publicRecordKey(existing.publicAccessId)', 'publicRecordsFromProjections', 'openDiceSetStore(context)', 'await store.delete(key)',
    'verifyRequestOrigin(request)', "Request origin is not allowed.",
    "bestEffortDelete(store, publicRecordKey(existing.publicAccessId), 'public projection')",
  ].forEach((text) => requireText(libraryApi, text, 'library API protection'));
  const deleteRecord = libraryApi.indexOf('await store.delete(key);');
  const deleteProjection = libraryApi.indexOf("bestEffortDelete(store, publicRecordKey(existing.publicAccessId), 'public projection')");
  const deleteImage = libraryApi.indexOf("bestEffortDelete(store, existing.trayImageKey, 'tray image')");
  if (deleteRecord < 0 || deleteProjection <= deleteRecord || deleteImage <= deleteRecord) throw new Error('Delete must remove the owner record before cleaning child blobs.');
  if (libraryApi.includes("url.searchParams.get('owner')")) throw new Error('Public library reads must not accept internal account identifiers.');
  if (/setJSON\([^\n]*index/i.test(libraryApi)) throw new Error('Library API must not write shared dice-set index blobs.');

  ['set.ownerId = userId', "set.id === SYSTEM_DEFAULT_DICE_SET_ID", 'MAX_CLOUD_SET_BYTES', 'Unlock the dice set before changing its name or appearance.']
    .forEach((text) => requireText(cloudRules, text, 'cloud rule'));
  [
    "path: '/api/dice-set-image'", "url.searchParams.get('public')", 'resolvePublicProjection(store, publicAccessId)',
    'record?.publicAccessId === publicAccessId', 'projection.legacy === true', 'const legacyCapability = !record?.publicAccessId',
    'user.id !== ownerId', "'Cache-Control': 'no-store'", 'openDiceSetStore(context)', 'X-Content-Type-Options',
  ].forEach((text) => requireText(imageApi, text, 'tray image API protection'));
  if (/max-age|public,\s*max-age|private,\s*max-age/.test(imageApi)) throw new Error('Capability-scoped tray images must not remain cacheable after visibility changes.');

  [
    "getStore({ name: diceSetStoreName(context), consistency: 'strong' })", "PUBLIC_DICE_SET_PREFIX = 'community/public-dice-sets/'",
    'LEGACY_COMMUNITY_INDEX', 'MAX_USER_DICE_SETS = 100', 'store.list({ prefix })', 'countUserRecords',
    'listUserRecords', 'listPublicProjections', 'listLegacyPublicProjections', 'resolvePublicProjection',
    'publicRecordKey', 'buildPublicProjection', 'versionedImageKey', 'isCurrentProjection', 'diceSetStoreName',
    "creator: 'Adventurer'", 'set.id = publicAccessId', 'set.ownerId = `community_${publicAccessId}`',
    '/api/dice-set-image?public=${encodeURIComponent(publicAccessId)}&token=', 'set.appearance.tray.image = null',
    "record.publicAccessId === projection.publicAccessId", "record.set.visibility === 'public'",
    "=== 'production' ? STORE_NAME : `${STORE_NAME}-nonprod`",
  ].forEach((text) => requireText(storeLayer, text, 'opaque authoritative storage contract'));
  console.log('Dice-set API contract passed: owner records are authoritative; mutations require trusted origins; production and preview stores are isolated; images/projections are staged or cleaned around owner commits; failed quota verification rolls back; public reads revalidate owner state; storage remains bounded and privacy-safe.');
} catch (error) {
  console.error('Dice-set API contract failed:', error);
  process.exitCode = 1;
}
