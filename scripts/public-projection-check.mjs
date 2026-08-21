import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';
import { buildPublicProjection, publicRecordKey, toPublicRecord } from '../netlify/functions/dice-set-store.mjs';

const internalOwnerId = 'internal_netlify_user_123';
const source = createUserDiceSet({ id: 'set_private_source', ownerId: internalOwnerId, name: 'Community Example' });
source.locked = true;
source.visibility = 'public';
source.appearance.tray.image = {
  kind: 'blob',
  url: `/api/dice-set-image?owner=${internalOwnerId}&set=${source.id}&token=secret123`,
};
const record = {
  set: source,
  creator: 'Private Account Name',
  trayImageKey: `users/${internalOwnerId}/dice-sets/${source.id}_tray`,
  trayImageAccessToken: 'secret123',
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T01:00:00.000Z',
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
assert.equal(publicRecordKey(publicAccessId), `community/public-dice-sets/${publicAccessId}.json`);
console.log('Public dice-set projection passed: public identity and tray images are opaque, account identifiers/profile names stay server-side, and the projected set remains valid and usable.');
