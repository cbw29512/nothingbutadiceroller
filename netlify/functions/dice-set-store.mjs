import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'dice-trays-store';
export const PUBLIC_DICE_SET_PREFIX = 'community/public-dice-sets/';
export const LEGACY_COMMUNITY_INDEX = 'community/dice-sets/index.json';

function keyPart(value) { return encodeURIComponent(String(value)); }
export function openDiceSetStore() {
  try {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  } catch (error) {
    console.error('Failed to open strong-consistency dice-set store:', error);
    throw error;
  }
}
export function userDiceSetPrefix(userId) { return `users/${keyPart(userId)}/dice-sets/`; }
export function recordKey(userId, setId) { return `${userDiceSetPrefix(userId)}${keyPart(setId)}.json`; }
export function imageKey(userId, setId) { return `${userDiceSetPrefix(userId)}${keyPart(setId)}_tray`; }
export function publicRecordKey(userId, setId) { return `${PUBLIC_DICE_SET_PREFIX}${keyPart(userId)}/${keyPart(setId)}.json`; }

export function publicCreator(value) {
  try {
    const text = String(value || '').trim();
    return text && !text.includes('@') ? text : 'Adventurer';
  } catch (error) {
    console.error('Failed to sanitize public dice-set creator:', error);
    return 'Adventurer';
  }
}
export function toPublicRecord(record) {
  try {
    return {
      set: record?.set || null,
      creator: publicCreator(record?.creator),
      createdAt: record?.createdAt || null,
      updatedAt: record?.updatedAt || null,
    };
  } catch (error) {
    console.error('Failed to create public dice-set record:', error);
    return { set: null, creator: 'Adventurer', createdAt: null, updatedAt: null };
  }
}
async function listRecords(store, prefix, predicate = () => true) {
  try {
    const { blobs = [] } = await store.list({ prefix });
    const keys = blobs.map((entry) => entry?.key).filter((key) => typeof key === 'string' && predicate(key));
    return (await Promise.all(keys.map((key) => store.get(key, { type: 'json' }).catch(() => null)))).filter(Boolean);
  } catch (error) {
    console.error(`Failed to list dice-set records under ${prefix}:`, error);
    throw error;
  }
}
export function listUserRecords(store, userId) {
  const prefix = userDiceSetPrefix(userId);
  return listRecords(store, prefix, (key) => key.endsWith('.json') && key !== `${prefix}index.json`);
}
export function listPublicRecords(store) {
  return listRecords(store, PUBLIC_DICE_SET_PREFIX, (key) => key.endsWith('.json'));
}
