import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) { if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`); }

try {
  const [saveApi, libraryApi, cloudRules, imageApi, storeLayer, concurrency, studio, studioCloud] = await Promise.all([
    read('netlify/functions/save-dice-set.mjs'), read('netlify/functions/dice-sets.mjs'),
    read('js/appearance/cloud-rules.mjs'), read('netlify/functions/dice-set-image.mjs'),
    read('netlify/functions/dice-set-store.mjs'), read('netlify/functions/dice-set-concurrency.mjs'),
    read('js/appearance/studio.js'), read('js/appearance/studio-cloud.mjs'),
  ]);
  [
    'const user = await getUser()', 'if (!user)', 'verifyRequestOrigin(request)', 'const rawSet = structuredClone',
    'extractTrayImageDataUrl', 'prepareCloudDiceSet(rawSet, userId)', 'assertLockedUpdateAllowed(existing, next)',
    "set.visibility === 'public' && set.locked", 'trayImageAccessToken', 'MAX_TRAY_IMAGE_BYTES', "creator: 'Adventurer'",
    'sanitizeTrayImageBytes(buffer, match[1].toLowerCase())', 'newPublicAccessId()', 'buildPublicProjection(record, publicAccessId)',
    'countUserRecords(store, user.id) >= MAX_USER_DICE_SETS', 'Post-save dice-set quota verification failed; rolling back new set:',
    'versionedImageKey(user.id, set.id, trayImageAccessToken)', 'previousTrayImageKey', 'stagedTrayImageKey',
    'bestEffortDelete(store, previousTrayImageKey', 'bestEffortDelete(store, publicRecordKey(previousPublicAccessId)',
    'Tray images must be uploaded through Dice Studio.', 'const rawTray = rawSet?.appearance?.tray;',
    'rawTray.image = ownerImage(user.id, rawSet.id, existing.trayImageAccessToken)',
    'normalizeExpectedVersion(body.version)', 'readVersionedRecord(store, key)', 'conditionalRecordWrite(store, key, record, version)',
    'recordVersion: randomUUID()', "apiErrorResponse(error, 'Unable to save dice set.')", "code: 'invalid-tray-image'",
  ].forEach((text) => requireText(saveApi, text, 'save API protection'));
  const ownerCommit = saveApi.indexOf('conditionalRecordWrite(store, key, record, version)');
  const projectionWrite = saveApi.indexOf('store.setJSON(publicRecordKey(publicAccessId), buildPublicProjection(record, publicAccessId))');
  const previousPublicCleanup = saveApi.indexOf("bestEffortDelete(store, publicRecordKey(previousPublicAccessId), 'previous public projection')");
  const previousImageCleanup = saveApi.indexOf("bestEffortDelete(store, previousTrayImageKey, 'previous tray image')");
  if (ownerCommit < 0 || projectionWrite <= ownerCommit) throw new Error('Authoritative conditional owner commit must happen before Community projection refresh.');
  if (previousPublicCleanup <= ownerCommit || previousImageCleanup <= ownerCommit) throw new Error('Previous public/image blobs must be cleaned only after the owner record commits.');
  if (saveApi.includes('user.email')) throw new Error('Dice-set creator metadata must never fall back to account email.');
  if (/user(?:Metadata|_metadata).*full.?name/i.test(saveApi)) throw new Error('Owner records must not store Identity profile names.');
  if (/return\s+json\(\{\s*error:\s*error\?*\.message/.test(saveApi)) throw new Error('Save API must not echo arbitrary exception messages.');
  if (/COMMUNITY_INDEX|indexKey\(|setJSON\([^\n]*index/i.test(saveApi)) throw new Error('Save API must not write shared dice-set index blobs.');

  [
    'const user = await getUser()', "scope === 'community'", 'listPublicProjections(store)', 'listLegacyPublicProjections(store, sources)',
    'listVersionedUserRecords(store, user.id)', 'readVersionedRecord(store, recordKey(user.id, setId))', 'publicRecordsFromProjections',
    'openDiceSetStore(context)', "request.headers.get('If-Match')", 'conditionalRecordWrite(store, key, tombstone, version)',
    'await store.delete(key)', 'verifyRequestOrigin(request)', "apiErrorResponse(error, 'Dice-set request failed.')",
    "bestEffortDelete(store, publicRecordKey(existing.record.publicAccessId), 'public projection')",
  ].forEach((text) => requireText(libraryApi, text, 'library API protection'));
  const tombstoneWrite = libraryApi.indexOf('conditionalRecordWrite(store, key, tombstone, version)');
  const deleteRecord = libraryApi.indexOf('await store.delete(key);', tombstoneWrite);
  const deleteProjection = libraryApi.indexOf("bestEffortDelete(store, publicRecordKey(existing.record.publicAccessId), 'public projection')", deleteRecord);
  const deleteImage = libraryApi.indexOf("bestEffortDelete(store, existing.record.trayImageKey, 'tray image')", deleteRecord);
  if (tombstoneWrite < 0 || deleteRecord <= tombstoneWrite || deleteProjection <= deleteRecord || deleteImage <= deleteRecord) {
    throw new Error('Delete must win a conditional tombstone before owner deletion and child cleanup.');
  }
  if (libraryApi.includes("url.searchParams.get('owner')")) throw new Error('Public library reads must not accept internal account identifiers.');
  if (/return\s+json\(\{\s*error:\s*error\?*\.message/.test(libraryApi)) throw new Error('Library API must not echo arbitrary exception messages.');
  if (/setJSON\([^\n]*index/i.test(libraryApi)) throw new Error('Library API must not write shared dice-set index blobs.');

  [
    "getWithMetadata(key, { type: 'json', consistency: 'strong' })", 'onlyIfMatch: currentVersion', 'onlyIfNew: true',
    "code: 'dice-set-version-conflict'", 'listVersionedUserRecords', 'normalizeExpectedVersion',
  ].forEach((text) => requireText(concurrency, text, 'concurrency contract'));
  [
    'let cloudVersions = new Map()', 'let draftVersion = null', 'saveCloudDiceSet(set, draftVersion)',
    'draftVersion = result.version', "error?.code !== 'dice-set-version-conflict'", 'cloudVersions.set(error.record.set.id, error.version)',
    'Your current draft is preserved', 'select the saved set again to reload the latest copy', 'deleteCloudDiceSet(draft.id, draftVersion)',
  ].forEach((text) => requireText(studio, text, 'Studio conflict behavior'));
  if (/handleCloudConflict[\s\S]*draftVersion\s*=\s*error\.version/.test(studio)) {
    throw new Error('A conflicted open draft must not inherit the latest server version automatically.');
  }
  ['body: JSON.stringify({ set, version })', "headers: version ? { 'If-Match': version } : {}", 'error.code = data.code || null', 'error.version = data.version ?? null']
    .forEach((text) => requireText(studioCloud, text, 'Studio cloud version transport'));

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
    'listPublicProjections', 'listLegacyPublicProjections', 'resolvePublicProjection', 'publicRecordKey', 'buildPublicProjection',
    'versionedImageKey', 'isCurrentProjection', 'diceSetStoreName', "creator: 'Adventurer'", 'set.id = publicAccessId',
    'set.ownerId = `community_${publicAccessId}`', '/api/dice-set-image?public=${encodeURIComponent(publicAccessId)}&token=',
    'set.appearance.tray.image = null', "record.publicAccessId === projection.publicAccessId", "record.set.visibility === 'public'",
    'projection?.recordVersion === record.recordVersion', "=== 'production' ? STORE_NAME : `${STORE_NAME}-nonprod`",
  ].forEach((text) => requireText(storeLayer, text, 'opaque authoritative storage contract'));
  console.log('Dice-set API contract passed: optimistic concurrency, safe API errors, fail-closed Community revisions, safe stale-delete handling, anonymous owner metadata, storage isolation, image lifecycle, and recoverable Studio conflicts are enforced.');
} catch (error) {
  console.error('Dice-set API contract failed:', error);
  process.exitCode = 1;
}
