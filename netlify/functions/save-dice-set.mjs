import { randomUUID } from 'node:crypto';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { assertLockedUpdateAllowed, collectModerationText, prepareCloudDiceSet } from '../../js/appearance/cloud-rules.mjs';
import { extractTrayImageDataUrl, MAX_TRAY_IMAGE_BYTES } from '../../js/appearance/tray-image.mjs';
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
  return { mime: match[1].toLowerCase(), buffer };
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

export default async (request, context) => {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  let cleanupStore = null; let stagedTrayImageKey = null; let stagedPublicKey = null;
  let stagedPublicWasNew = false; let recordCommitted = false;
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);
    verifyRequestOrigin(request);
    const body = await request.json();
    const rawSet = structuredClone(body?.set || {});
    const incomingImage = rawSet?.appearance?.tray?.image ?? null;
    const incomingDataUrl = extractTrayImageDataUrl(incomingImage);
    const store = openDiceSetStore(context); cleanupStore = store;
    const key = recordKey(user.id, rawSet.id);
    const existing = await store.get(key, { type: 'json' }).catch(() => null);
    const isNewSet = !existing;
    if (isNewSet && await countUserRecords(store, user.id) >= MAX_USER_DICE_SETS) throw quotaError();
    if (existing?.set?.locked && incomingDataUrl) throw new Error('Unlock the dice set before changing its tray image.');

    const rawTray = rawSet?.appearance?.tray;
    if (rawTray && (incomingDataUrl || incomingImage == null)) rawTray.image = null;
    else if (rawTray && existing?.trayImageKey && existing?.trayImageAccessToken) {
      rawTray.image = ownerImage(user.id, rawSet.id, existing.trayImageAccessToken);
    } else if (rawTray && existing?.set?.appearance?.tray?.image && sameJson(incomingImage, existing.set.appearance.tray.image)) {
      rawTray.image = structuredClone(existing.set.appearance.tray.image);
    } else if (incomingImage != null) {
      throw new Error('Tray images must be uploaded through Dice Studio.');
    }

    let set = prepareCloudDiceSet(rawSet, user.id);
    if (existing?.set) assertLockedUpdateAllowed(existing.set, set);
    if (matcher.hasMatch(collectModerationText(set))) {
      return json({ error: 'Please remove inappropriate terms before saving this dice set.' }, 400);
    }

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
      set, creator: user.userMetadata?.fullName || user.user_metadata?.full_name || 'Adventurer',
      trayImageKey, trayImageAccessToken, publicAccessId,
      createdAt: existing?.createdAt || now, updatedAt: now,
    };

    if (publicLocked) {
      stagedPublicKey = publicRecordKey(publicAccessId);
      stagedPublicWasNew = publicAccessId !== previousPublicAccessId;
      await store.setJSON(stagedPublicKey, buildPublicProjection(record, publicAccessId));
    }
    await store.setJSON(key, record); recordCommitted = true;

    if (isNewSet) {
      let overQuota = false;
      try { overQuota = await countUserRecords(store, user.id) > MAX_USER_DICE_SETS; }
      catch (error) {
        console.error('Post-save dice-set quota verification failed; rolling back new set:', error);
        await store.delete(key); recordCommitted = false;
        if (stagedTrayImageKey) { await bestEffortDelete(store, stagedTrayImageKey, 'staged tray image'); stagedTrayImageKey = null; }
        if (stagedPublicKey) { await bestEffortDelete(store, stagedPublicKey, 'staged public projection'); stagedPublicKey = null; }
        throw new Error('Unable to verify the dice-set storage limit. The save was rolled back; retry.');
      }
      if (overQuota) {
        await store.delete(key); recordCommitted = false;
        if (stagedTrayImageKey) { await bestEffortDelete(store, stagedTrayImageKey, 'staged tray image'); stagedTrayImageKey = null; }
        if (stagedPublicKey) { await bestEffortDelete(store, stagedPublicKey, 'staged public projection'); stagedPublicKey = null; }
        throw quotaError();
      }
    }

    if (previousPublicAccessId && previousPublicAccessId !== publicAccessId) {
      await bestEffortDelete(store, publicRecordKey(previousPublicAccessId), 'previous public projection');
    }
    if (previousTrayImageKey && previousTrayImageKey !== trayImageKey) {
      await bestEffortDelete(store, previousTrayImageKey, 'previous tray image');
    }
    return json({ success: true, record });
  } catch (error) {
    if (!recordCommitted && stagedTrayImageKey) await bestEffortDelete(cleanupStore, stagedTrayImageKey, 'staged tray image');
    if (!recordCommitted && stagedPublicWasNew && stagedPublicKey) await bestEffortDelete(cleanupStore, stagedPublicKey, 'staged public projection');
    const status = Number(error?.status || error?.statusCode) || 400;
    if (status === 403) return json({ error: 'Request origin is not allowed.' }, 403);
    console.error('Save V2 dice set failed:', error);
    return json({ error: error?.message || 'Unable to save dice set.' }, 400);
  }
};
export const config = { path: '/api/save-dice-set' };
