import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import {
  assertLockedUpdateAllowed,
  collectModerationText,
  prepareCloudDiceSet,
} from '../../js/appearance/cloud-rules.mjs';

const STORE_NAME = 'dice-trays-store';
const COMMUNITY_INDEX = 'community/dice-sets/index.json';
const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function recordKey(userId, setId) { return `users/${userId}/dice-sets/${setId}.json`; }
function indexKey(userId) { return `users/${userId}/dice-sets/index.json`; }
async function readArray(store, key) {
  const value = await store.get(key, { type: 'json' }).catch(() => []);
  return Array.isArray(value) ? value : [];
}

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);
    const body = await request.json();
    const set = prepareCloudDiceSet(body?.set, user.id);
    if (matcher.hasMatch(collectModerationText(set))) {
      return json({ error: 'Please remove inappropriate terms before saving this dice set.' }, 400);
    }

    const store = getStore(STORE_NAME);
    const key = recordKey(user.id, set.id);
    const existing = await store.get(key, { type: 'json' }).catch(() => null);
    if (existing?.set) assertLockedUpdateAllowed(existing.set, set);

    const now = new Date().toISOString();
    const record = {
      set,
      creator: user.userMetadata?.fullName || user.user_metadata?.full_name || user.email || 'Adventurer',
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
    if (set.visibility === 'public' && set.locked) {
      communityNext.unshift({ ownerId: user.id, setId: set.id, name: set.name, creator: record.creator, updatedAt: now });
    }
    await store.setJSON(COMMUNITY_INDEX, communityNext.slice(0, 500));
    return json({ success: true, record });
  } catch (error) {
    console.error('Save V2 dice set failed:', error);
    return json({ error: error?.message || 'Unable to save dice set.' }, 400);
  }
};

export const config = { path: '/api/save-dice-set' };
