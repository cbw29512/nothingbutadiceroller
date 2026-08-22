import { randomUUID } from 'node:crypto';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { assertLockedUpdateAllowed, collectModerationText, prepareCloudDiceSet } from '../../js/appearance/cloud-rules.mjs';
import { extractTrayImageDataUrl, MAX_TRAY_IMAGE_BYTES } from '../../js/appearance/tray-image.mjs';
import {
  conditionalRecordWrite, normalizeExpectedVersion, readVersionedRecord, versionConflict,
} from './dice-set-concurrency.mjs';
import { sanitizeTrayImageBytes } from './image-sanitizer/index.mjs';
import {
  buildPublicProjection, countUserRecords, MAX_USER_DICE_SETS, openDiceSetStore,
  publicRecordKey, recordKey, versionedImageKey,
} from './dice-set-store.mjs';

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
function json(body, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
function parseImage(dataUrl) {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);
  if (!match) throw new Error('Tray image must be PNG, JPEG, or WebP.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > MAX_TRAY_IMAGE_BYTES) throw new Error('Tray image must be 4 MB or smaller.');
  return sanitizeTrayImageBytes(buffer, match[1].toLowerCase());
}
function newPublicAccessId() { return `public_${randomUUID().replaceAll('-', '')}`; }
function quotaError() { return new Error(`You can save up to ${MAX_USER_DICE_SETS} dice sets per account.`); }
function ownerImage(userId, setId, token) {
  return { kind: 'blob', url: `/api/dice-set-image?owner=${encodeURIComponent(userId)}&set=${encodeURIComponent(setId)}&token=${token}` };
}
function sameJson(left, right) { return JSON.stringify(left ?? null) === JSON.stringify(right ?? null); }
async function bestEffortDelete(store, key, label) {
  if (!store || !key) return;
  try { await store.delete(key); } catch (error) { console.warn(`Failed to clean up ${label}:`, error); }
}
async function rollbackNewRecord(store, key, version) {
  const marker = { deletionMarker: true, deletedAt: new Date().toISOString() };
  const result = await store.setJSON(key, marker, { onlyIfMatch: version });
  if (!result?.modified) throw new Error('The new dice set changed before quota rollback could finish. Reload Dice Studio.');
  await store.delete(key);
}

export default async (request, context) => {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  let cleanupStore = null; let stagedTrayImageKey = null; let recordCommitted = false;
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);
    verifyRequestOrigin(request);
    const body = await request.json();
    if (!Object.prototype.hasOwnProperty.call(body || {}, 'version')) throw new Error('Dice-set version is required; reload before saving.');
    const expectedVersion = normalizeExpectedVersion(body.version);
    const rawSet = structuredClone(body?.set || {});
    const incomingImage = rawSet?.appearance?.tray?.image ?? null;
    const incomingDataUrl = extractTrayImageDataUrl(incomingImage);
    const store = openDiceSetStore(context); cleanupStore = store;
    const key = recordKey(user.id, rawSet.id);
    const current = await readVersionedRecord(store, key);
    if (expectedVersion !== (current?.version || null)) return json(versionConflict(current), 409);
    const existing = current?.record || null;
    const isNewSet = !existing;
    if (isNewSet && await countUserRecords(store, user.id) >= MAX_USER_DICE_SETS) throw quotaError();
    if (existing?.set?.locked && incomingDataUrl) throw new Error('Unlock the dice set before changing its tray image.');

    const rawTray = rawSet?.appearance?.tray;
    if (rawTray && (incomingDataUrl || incomingImage == null)) rawTray.image = null;
    else if (rawTray && existing?.trayImageKey && existing?.trayImageAccessToken) {
      rawTray.image = ownerImage(user.id, rawSet.id, existing.trayImageAccessToken);
    } else if (rawTray && existing?.set?.appearance?.tray?.image && sameJson(incomingImage, existing.set.appearance.tray.image)) {
      rawTray.image = structuredClone(existing.set.appearance.tray.image);
    } else if (incomingImage != null) throw new Error('Tray images must be uploaded through Dice Studio.');

    let set = prepareCloudDiceSet(rawSet, user.id);
    if (existing?.set) assertLockedUpdateAllowed(existing.set, set);
    if (matcher.hasMatch(collectModerationText(set))) return json({ error: 'Please remove inappropriate terms before saving this dice set.' }, 400);

    const previousTrayImageKey = existing?.trayImageKey || null;
    let trayImageKey = previousTrayImageKey;
    let trayImageAccessToken = existing?.trayImageAccessToken || null;
    const parsedImage = parseImage(incomingDataUrl);
    if (parsedImage) {
      trayImageAccessToken = randomUUID().replaceAll('-', '');
      stagedTrayImageKey = versionedImageKey(user.id, set.id, trayImageAccessToken);
      await store.set(stagedTrayImageKey, parsedImage.buffer, { metadata: { contentType: parsedImage.mime } });
      trayImageKey = stagedTrayImageKey;
      set.appearance.tray.image = ownerImage(user.id, set.id, trayImageAccessToken);
      set = prepareCloudDiceSet(set, user.id);
    } else if (incomingImage == null) {
      trayImageKey = null; trayImageAccessToken = null; set.appearance.tray.image = null;
    }

    const now = new Date().toISOString();
    const publicLocked = set.visibility === 'public' && set.locked;
    const previousPublicAccessId = existing?.publicAccessId || null;
    const existingIsPublic = existing?.set?.visibility === 'public' && existing?.set?.locked;
    let publicAccessId = publicLocked && existingIsPublic ? previousPublicAccessId : null;
    if (publicLocked && !publicAccessId) publicAccessId = newPublicAccessId();
    const record = {
      set, creator: 'Adventurer', trayImageKey, trayImageAccessToken, publicAccessId,
      recordVersion: randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now,
    };

    const committed = await conditionalRecordWrite(store, key, record, expectedVersion);
    if (committed.conflict) {
      if (stagedTrayImageKey) await bestEffortDelete(store, stagedTrayImageKey, 'staged tray image');
      stagedTrayImageKey = null;
      return json(committed.conflict, 409);
    }
    recordCommitted = true;

    if (isNewSet) {
      let overQuota;
      try { overQuota = await countUserRecords(store, user.id) > MAX_USER_DICE_SETS; }
      catch (error) {
        console.error('Post-save dice-set quota verification failed; rolling back new set:', error);
        await rollbackNewRecord(store, key, committed.version); recordCommitted = false;
        if (stagedTrayImageKey) await bestEffortDelete(store, stagedTrayImageKey, 'staged tray image');
        stagedTrayImageKey = null;
        throw new Error('Unable to verify the dice-set storage limit. The save was rolled back; retry.');
      }
      if (overQuota) {
        await rollbackNewRecord(store, key, committed.version); recordCommitted = false;
        if (stagedTrayImageKey) await bestEffortDelete(store, stagedTrayImageKey, 'staged tray image');
        stagedTrayImageKey = null;
        throw quotaError();
      }
    }

    let warning = null;
    if (publicLocked) {
      try { await store.setJSON(publicRecordKey(publicAccessId), buildPublicProjection(record, publicAccessId)); }
      catch (error) {
        console.error('Owner save succeeded but Community projection refresh failed:', error);
        warning = 'Dice set saved, but Community publication could not be refreshed. Retry Save.';
      }
    }
    if (previousPublicAccessId && previousPublicAccessId !== publicAccessId) {
      await bestEffortDelete(store, publicRecordKey(previousPublicAccessId), 'previous public projection');
    }
    if (previousTrayImageKey && previousTrayImageKey !== trayImageKey) {
      await bestEffortDelete(store, previousTrayImageKey, 'previous tray image');
    }
    return json({ success: true, record, version: committed.version, warning });
  } catch (error) {
    if (!recordCommitted && stagedTrayImageKey) await bestEffortDelete(cleanupStore, stagedTrayImageKey, 'staged tray image');
    const status = Number(error?.status || error?.statusCode) || 400;
    if (status === 403) return json({ error: 'Request origin is not allowed.' }, 403);
    console.error('Save V2 dice set failed:', error);
    return json({ error: error?.message || 'Unable to save dice set.' }, status >= 400 && status < 600 ? status : 400);
  }
};
export const config = { path: '/api/save-dice-set' };
