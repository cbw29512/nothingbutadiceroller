import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { readModerationBlock } from './community-moderation-store.mjs';

export const STORE_NAME = 'dice-trays-store';
export const PUBLIC_DICE_SET_PREFIX = 'community/public-dice-sets/';
export const LEGACY_COMMUNITY_INDEX = 'community/dice-sets/index.json';
export const MAX_USER_DICE_SETS = 100;
export const MAX_COMMUNITY_CURRENT_CANDIDATES = 1000;
export const MAX_COMMUNITY_LEGACY_CANDIDATES = 250;

function keyPart(value) { return encodeURIComponent(String(value)); }
function legacyPublicAccessId(ownerId, setId) {
  const hash = createHash('sha256').update(`${ownerId}\u0000${setId}`).digest('hex').slice(0, 32);
  return `public_legacy_${hash}`;
}
export function diceSetStoreName(context) {
  return String(context?.deploy?.context || 'dev') === 'production' ? STORE_NAME : `${STORE_NAME}-nonprod`;
}
export function openDiceSetStore(context) {
  try { return getStore({ name: diceSetStoreName(context), consistency: 'strong' }); } catch (error) { console.error('Failed to open strong-consistency dice-set store:', error); throw error; }
}
export function userDiceSetPrefix(userId) { return `users/${keyPart(userId)}/dice-sets/`; }
export function recordKey(userId, setId) { return `${userDiceSetPrefix(userId)}${keyPart(setId)}.json`; }
export function imageKey(userId, setId) { return `${userDiceSetPrefix(userId)}${keyPart(setId)}_tray`; }
export function versionedImageKey(userId, setId, version) {
  const safeVersion = String(version || '').trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(safeVersion)) throw new Error('Tray image version is invalid.');
  return `${imageKey(userId, setId)}_${keyPart(safeVersion)}`;
}
export function publicRecordKey(publicAccessId) { return `${PUBLIC_DICE_SET_PREFIX}${keyPart(publicAccessId)}.json`; }
function isUserRecordKey(key, prefix) { return key.endsWith('.json') && key !== `${prefix}index.json`; }

function publicSet(record, publicAccessId) {
  const set = structuredClone(record?.set || {});
  set.id = publicAccessId;
  set.ownerId = `community_${publicAccessId}`;
  const image = set?.appearance?.tray?.image;
  if (image && record?.trayImageAccessToken) {
    set.appearance.tray.image = {
      kind: 'blob',
      url: `/api/dice-set-image?public=${encodeURIComponent(publicAccessId)}&token=${record.trayImageAccessToken}`,
    };
  } else if (image) {
    set.appearance.tray.image = null;
  }
  return set;
}
export function toPublicRecord(record, publicAccessId) {
  try {
    return {
      set: publicSet(record, publicAccessId),
      creator: 'Adventurer',
      createdAt: record?.createdAt || null,
      updatedAt: record?.updatedAt || null,
    };
  } catch (error) {
    console.error('Failed to create privacy-safe public dice-set record:', error);
    return null;
  }
}
export function buildPublicProjection(record, publicAccessId, { legacy = false } = {}) {
  try {
    const publicRecord = toPublicRecord(record, publicAccessId);
    if (!publicRecord) throw new Error('Unable to create public dice-set projection.');
    return {
      publicAccessId,
      ownerId: record.set.ownerId,
      setId: record.set.id,
      recordVersion: record.recordVersion || null,
      legacy,
      publicRecord,
    };
  } catch (error) {
    console.error('Failed to build public dice-set projection:', error);
    throw error;
  }
}
async function listKeys(store, prefix, { bounded = false, maxKeys = Number.POSITIVE_INFINITY } = {}) {
  try {
    if (!bounded) {
      const { blobs = [] } = await store.list({ prefix });
      return blobs.map((entry) => entry?.key).filter((key) => typeof key === 'string');
    }
    for await (const page of store.list({ prefix, paginate: true })) {
      const keys = (page?.blobs || []).map((entry) => entry?.key).filter((key) => typeof key === 'string');
      return keys.slice(0, Math.max(0, maxKeys));
    }
    return [];
  } catch (error) {
    console.error(`Failed to list dice-set keys under ${prefix}:`, error);
    throw error;
  }
}
async function listRecords(store, prefix, predicate = () => true, options = {}) {
  try {
    const keys = (await listKeys(store, prefix, options)).filter(predicate);
    return (await Promise.all(keys.map((key) => store.get(key, { type: 'json' }).catch(() => null)))).filter(Boolean);
  } catch (error) {
    console.error(`Failed to list dice-set records under ${prefix}:`, error);
    throw error;
  }
}
function isCurrentProjection(projection, record, blocked = false) {
  const revisionMatches = !record?.recordVersion || projection?.recordVersion === record.recordVersion;
  return Boolean(
    !blocked
    && projection?.publicAccessId && projection?.ownerId && projection?.setId
    && record?.set?.locked && record.set.visibility === 'public'
    && record.publicAccessId === projection.publicAccessId
    && record.set.ownerId === projection.ownerId
    && record.set.id === projection.setId
    && revisionMatches
  );
}
export async function countUserRecords(store, userId) {
  try {
    const prefix = userDiceSetPrefix(userId);
    return (await listKeys(store, prefix)).filter((key) => isUserRecordKey(key, prefix)).length;
  } catch (error) {
    console.error('Failed to count user dice sets:', error);
    throw error;
  }
}
export function listUserRecords(store, userId) {
  const prefix = userDiceSetPrefix(userId); return listRecords(store, prefix, (key) => isUserRecordKey(key, prefix));
}
export async function listPublicProjections(store, maxCandidates = MAX_COMMUNITY_CURRENT_CANDIDATES) {
  const projections = await listRecords(
    store,
    PUBLIC_DICE_SET_PREFIX,
    (key) => key.endsWith('.json'),
    { bounded: true, maxKeys: maxCandidates },
  );
  const current = await Promise.all(projections.map(async (projection) => {
    if (!projection?.ownerId || !projection?.setId) return null;
    const [record, moderation] = await Promise.all([
      store.get(recordKey(projection.ownerId, projection.setId), { type: 'json' }).catch(() => null),
      readModerationBlock(store, projection.ownerId, projection.setId),
    ]);
    return isCurrentProjection(projection, record, Boolean(moderation)) ? projection : null;
  }));
  return current.filter(Boolean);
}
async function readLegacyIndex(store) {
  const value = await store.get(LEGACY_COMMUNITY_INDEX, { type: 'json' }).catch(() => []);
  return Array.isArray(value) ? value : [];
}
export async function listLegacyPublicProjections(store, excludedSources = new Set(), maxCandidates = MAX_COMMUNITY_LEGACY_CANDIDATES) {
  try {
    const index = await readLegacyIndex(store);
    const projections = [];
    let scanned = 0;
    for (const item of index) {
      if (scanned >= maxCandidates) break;
      scanned += 1;
      const sourceKey = JSON.stringify([item?.ownerId, item?.setId]);
      if (!item?.ownerId || !item?.setId || excludedSources.has(sourceKey)) continue;
      const [record, moderation] = await Promise.all([
        store.get(recordKey(item.ownerId, item.setId), { type: 'json' }).catch(() => null),
        readModerationBlock(store, item.ownerId, item.setId),
      ]);
      if (moderation || !record?.set?.locked || record.set.visibility !== 'public' || record?.publicAccessId) continue;
      projections.push(buildPublicProjection(record, legacyPublicAccessId(item.ownerId, item.setId), { legacy: true }));
    }
    return projections;
  } catch (error) {
    console.error('Failed to load legacy public dice-set projections:', error);
    return [];
  }
}
export async function resolvePublicProjection(store, publicAccessId) {
  try {
    const current = await store.get(publicRecordKey(publicAccessId), { type: 'json' }).catch(() => null);
    if (current?.publicAccessId === publicAccessId) {
      const [record, moderation] = await Promise.all([
        store.get(recordKey(current.ownerId, current.setId), { type: 'json' }).catch(() => null),
        readModerationBlock(store, current.ownerId, current.setId),
      ]);
      return isCurrentProjection(current, record, Boolean(moderation)) ? current : null;
    }
    const legacyIndex = await readLegacyIndex(store);
    const legacy = legacyIndex.find((item) => item?.ownerId && item?.setId && legacyPublicAccessId(item.ownerId, item.setId) === publicAccessId);
    if (!legacy) return null;
    const [record, moderation] = await Promise.all([
      store.get(recordKey(legacy.ownerId, legacy.setId), { type: 'json' }).catch(() => null),
      readModerationBlock(store, legacy.ownerId, legacy.setId),
    ]);
    if (moderation || !record?.set?.locked || record.set.visibility !== 'public' || record?.publicAccessId) return null;
    return buildPublicProjection(record, publicAccessId, { legacy: true });
  } catch (error) {
    console.error('Failed to resolve public dice-set projection:', error);
    return null;
  }
}