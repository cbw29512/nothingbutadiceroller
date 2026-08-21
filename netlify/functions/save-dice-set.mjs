import { randomUUID } from 'node:crypto';
import { getUser } from '@netlify/identity';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { assertLockedUpdateAllowed, collectModerationText, prepareCloudDiceSet } from '../../js/appearance/cloud-rules.mjs';
import { extractTrayImageDataUrl, MAX_TRAY_IMAGE_BYTES } from '../../js/appearance/tray-image.mjs';
import { imageKey, openDiceSetStore, publicRecordKey, recordKey, toPublicRecord } from './dice-set-store.mjs';

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

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);
    const body = await request.json();
    const rawSet = structuredClone(body?.set || {});
    const incomingImage = rawSet?.appearance?.tray?.image ?? null;
    const incomingDataUrl = extractTrayImageDataUrl(incomingImage);
    const store = openDiceSetStore();
    const key = recordKey(user.id, rawSet.id);
    const existing = await store.get(key, { type: 'json' }).catch(() => null);
    if (existing?.set?.locked && incomingDataUrl) throw new Error('Unlock the dice set before changing its tray image.');

    if (incomingDataUrl) rawSet.appearance.tray.image = null;
    let set = prepareCloudDiceSet(rawSet, user.id);
    if (existing?.set) assertLockedUpdateAllowed(existing.set, set);
    if (matcher.hasMatch(collectModerationText(set))) return json({ error: 'Please remove inappropriate terms before saving this dice set.' }, 400);

    let trayImageKey = existing?.trayImageKey || null;
    let trayImageAccessToken = existing?.trayImageAccessToken || null;
    const parsedImage = parseImage(incomingDataUrl);
    if (parsedImage) {
      trayImageKey = imageKey(user.id, set.id);
      trayImageAccessToken = randomUUID().replaceAll('-', '');
      await store.set(trayImageKey, parsedImage.buffer, { metadata: { contentType: parsedImage.mime } });
      set.appearance.tray.image = {
        kind: 'blob',
        url: `/api/dice-set-image?owner=${encodeURIComponent(user.id)}&set=${encodeURIComponent(set.id)}&token=${trayImageAccessToken}`,
      };
      set = prepareCloudDiceSet(set, user.id);
    } else if (incomingImage == null && trayImageKey) {
      await store.delete(trayImageKey);
      trayImageKey = null; trayImageAccessToken = null;
      set.appearance.tray.image = null;
    }

    const now = new Date().toISOString();
    const record = {
      set,
      creator: user.userMetadata?.fullName || user.user_metadata?.full_name || 'Adventurer',
      trayImageKey, trayImageAccessToken,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const publicKey = publicRecordKey(user.id, set.id);
    const publicLocked = set.visibility === 'public' && set.locked;
    if (!publicLocked) await store.delete(publicKey);
    await store.setJSON(key, record);
    if (publicLocked) await store.setJSON(publicKey, toPublicRecord(record));
    return json({ success: true, record });
  } catch (error) {
    console.error('Save V2 dice set failed:', error);
    return json({ error: error?.message || 'Unable to save dice set.' }, 400);
  }
};
export const config = { path: '/api/save-dice-set' };
