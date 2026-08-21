import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { assertLockedUpdateAllowed, collectModerationText, prepareCloudDiceSet } from '../../js/appearance/cloud-rules.mjs';
import { extractTrayImageDataUrl, MAX_TRAY_IMAGE_BYTES } from '../../js/appearance/tray-image.mjs';

const STORE_NAME = 'dice-trays-store';
const COMMUNITY_INDEX = 'community/dice-sets/index.json';
const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
function json(body, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
function recordKey(userId, setId) { return `users/${userId}/dice-sets/${setId}.json`; }
function indexKey(userId) { return `users/${userId}/dice-sets/index.json`; }
function imageKey(userId, setId) { return `users/${userId}/dice-sets/${setId}_tray`; }
async function readArray(store, key) {
  const value = await store.get(key, { type: 'json' }).catch(() => []);
  return Array.isArray(value) ? value : [];
}
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
    const incomingDataUrl = extractTrayImageDataUrl(rawSet?.appearance?.tray?.image);
    const store = getStore(STORE_NAME);
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
    } else if (existing?.set?.appearance?.tray?.image && !set.appearance.tray.image) {
      set.appearance.tray.image = structuredClone(existing.set.appearance.tray.image);
    }

    const now = new Date().toISOString();
    const record = {
      set,
      creator: user.userMetadata?.fullName || user.user_metadata?.full_name || user.email || 'Adventurer',
      trayImageKey, trayImageAccessToken,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await store.setJSON(key, record);
    const mine = await readArray(store, indexKey(user.id));
    const mineNext = mine.filter((item) => item.setId !== set.id);
    mineNext.unshift({ setId: set.id, name: set.name, locked: set.locked, visibility: set.visibility, updatedAt: now });
    await store.setJSON(indexKey(user.id), mineNext.slice(0, 100));
    const community = await readArray(store, COMMUNITY_INDEX);
    const communityNext = community.filter((item) => !(item.ownerId === user.id && item.setId === set.id));
    if (set.visibility === 'public' && set.locked) communityNext.unshift({ ownerId: user.id, setId: set.id, name: set.name, creator: record.creator, updatedAt: now });
    await store.setJSON(COMMUNITY_INDEX, communityNext.slice(0, 500));
    return json({ success: true, record });
  } catch (error) {
    console.error('Save V2 dice set failed:', error);
    return json({ error: error?.message || 'Unable to save dice set.' }, 400);
  }
};
export const config = { path: '/api/save-dice-set' };
