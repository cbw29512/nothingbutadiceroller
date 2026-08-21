import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';
import {
  buildPublicProjection, countUserRecords, diceSetStoreName, listPublicProjections, MAX_USER_DICE_SETS,
  publicRecordKey, recordKey, resolvePublicProjection, toPublicRecord,
} from '../netlify/functions/dice-set-store.mjs';

const internalOwnerId = 'internal_netlify_user_123';
const source = createUserDiceSet({ id: 'set_private_source', ownerId: internalOwnerId, name: 'Community Example' });
source.locked = true; source.visibility = 'public';
source.appearance.tray.image = {
  kind: 'blob',
  url: `/api/dice-set-image?owner=${internalOwnerId}&set=${source.id}&token=secret123`,
};
const record = {
  set: source, creator: 'Private Account Name',
  trayImageKey: `users/${internalOwnerId}/dice-sets/${source.id}_tray`,
  trayImageAccessToken: 'secret123',
  createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T01:00:00.000Z',
};
const publicAccessId = 'public_0123456789abcdef0123456789abcdef';
const publicRecord = toPublicRecord(record, publicAccessId);
const projection = buildPublicProjection(record, publicAccessId);

assert.equal(publicRecord.set.id, publicAccessId);
assert.equal(publicRecord.set.ownerId, `community_${publicAccessId}`);
assert.equal(publicRecord.creator, 'Adventurer', 'Account display names are not public identity by default.');
assert.equal(publicRecord.set.appearance.tray.image.url, `/api/dice-set-image?public=${publicAccessId}&token=secret123`);
assert.equal(validateDiceSet(publicRecord.set).ok, true, 'Privacy-safe public projection must remain a valid usable dice set.');
const serializedPublic = JSON.stringify(publicRecord);
assert.equal(serializedPublic.includes(internalOwnerId), false, 'Public payload must not contain the internal account id.');
assert.equal(serializedPublic.includes('owner='), false, 'Public tray-image URL must not use an account locator.');
assert.equal(serializedPublic.includes('Private Account Name'), false, 'Public payload must not expose account profile name implicitly.');
assert.equal(projection.ownerId, internalOwnerId, 'Internal projection may retain the private locator server-side.');
assert.equal(JSON.stringify(projection.publicRecord).includes(internalOwnerId), false);

const legacyWithoutCapability = structuredClone(record);
delete legacyWithoutCapability.trayImageAccessToken;
legacyWithoutCapability.set.appearance.tray.image = {
  kind: 'legacy',
  url: `/api/theme-image?owner=${internalOwnerId}&theme=old_theme&token=oldsecret`,
};
const sanitizedLegacy = toPublicRecord(legacyWithoutCapability, 'public_legacy_safe');
assert.equal(sanitizedLegacy.set.appearance.tray.image, null, 'A public projection without an image capability must fail closed.');
assert.equal(JSON.stringify(sanitizedLegacy).includes(internalOwnerId), false);
assert.equal(validateDiceSet(sanitizedLegacy.set).ok, true);

const staleOwnerId = 'stale_owner';
const staleSource = createUserDiceSet({ id: 'stale_set', ownerId: staleOwnerId, name: 'Staged Set' });
staleSource.locked = true; staleSource.visibility = 'public';
const staleAccessId = 'public_fedcba9876543210fedcba9876543210';
const staleProjection = buildPublicProjection({ set: staleSource }, staleAccessId);
const currentRecord = { ...record, publicAccessId };
const staleOwnerRecord = { set: { ...staleSource, visibility: 'private' }, publicAccessId: null };
const projectionStore = {
  async list({ prefix }) {
    return { blobs: [{ key: publicRecordKey(publicAccessId) }, { key: publicRecordKey(staleAccessId) }].filter((item) => item.key.startsWith(prefix)) };
  },
  async get(key) {
    if (key === publicRecordKey(publicAccessId)) return projection;
    if (key === publicRecordKey(staleAccessId)) return staleProjection;
    if (key === recordKey(internalOwnerId, source.id)) return currentRecord;
    if (key === recordKey(staleOwnerId, staleSource.id)) return staleOwnerRecord;
    return null;
  },
};
const visible = await listPublicProjections(projectionStore);
assert.deepEqual(visible.map((item) => item.publicAccessId), [publicAccessId], 'Only projections confirmed by the owner record may be listed.');
assert.equal(await resolvePublicProjection(projectionStore, staleAccessId), null, 'A staged or stale projection must not resolve publicly.');

assert.equal(publicRecordKey(publicAccessId), `community/public-dice-sets/${publicAccessId}.json`);
assert.equal(diceSetStoreName({ deploy: { context: 'production' } }), 'dice-trays-store');
assert.equal(diceSetStoreName({ deploy: { context: 'deploy-preview' } }), 'dice-trays-store-nonprod');
assert.equal(diceSetStoreName({ deploy: { context: 'branch-deploy' } }), 'dice-trays-store-nonprod');
assert.equal(diceSetStoreName(), 'dice-trays-store-nonprod');
assert.equal(MAX_USER_DICE_SETS, 100);
const quotaStore = {
  async list({ prefix }) {
    return { blobs: [
      { key: `${prefix}set_one.json` }, { key: `${prefix}set_two.json` },
      { key: `${prefix}index.json` }, { key: `${prefix}set_one_tray` },
    ] };
  },
};
assert.equal(await countUserRecords(quotaStore, internalOwnerId), 2, 'Quota count must include only persisted dice-set JSON records.');
console.log('Public dice-set projection passed: production/preview stores are isolated, public identity/images are opaque, stale projections fail closed against owner records, legacy images without capabilities are removed, and quota counts only real set records.');
