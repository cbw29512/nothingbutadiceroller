import { normalizeDiceSetId } from './identifiers.mjs';
import { createUserDiceSet, cloneDiceSet } from './schema.mjs';

const IMPORT_PREFIX = 'browser_';
function shortHash(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(36).padStart(7, '0');
}
export function buildBrowserImportId(sourceId) {
  try {
    const source = normalizeDiceSetId(sourceId);
    const suffix = shortHash(source);
    const maxSourceLength = 80 - IMPORT_PREFIX.length - suffix.length - 1;
    return normalizeDiceSetId(`${IMPORT_PREFIX}${source.slice(0, maxSourceLength)}_${suffix}`);
  } catch (error) {
    console.error('Failed to build browser-import dice-set id:', error);
    throw error;
  }
}
export function getImportableBrowserSets(browserSets = [], cloudSets = []) {
  try {
    const cloudIds = new Set((cloudSets || []).map((set) => set?.id).filter(Boolean));
    return (browserSets || [])
      .filter((set) => set && !set.systemOwned && !cloudIds.has(buildBrowserImportId(set.id)))
      .map(cloneDiceSet);
  } catch (error) {
    console.error('Failed to resolve importable browser dice sets:', error);
    return [];
  }
}
export function buildBrowserImportSet(source, userId) {
  try {
    if (!source || source.systemOwned) throw new Error('A browser-owned dice set is required.');
    return createUserDiceSet({ id: buildBrowserImportId(source.id), ownerId: userId, name: source.name, appearance: source.appearance });
  } catch (error) {
    console.error('Failed to prepare browser dice set for account import:', error);
    throw error;
  }
}
export async function importBrowserSets({ browserSets = [], cloudSets = [], userId, saveSet } = {}) {
  try {
    if (!String(userId || '').trim()) throw new Error('A signed-in account is required to import browser dice sets.');
    if (typeof saveSet !== 'function') throw new Error('A cloud dice-set saver is required.');
    let nextCloudSets = (cloudSets || []).map(cloneDiceSet);
    const imported = [];
    const failures = [];
    for (const source of getImportableBrowserSets(browserSets, nextCloudSets)) {
      try {
        const prepared = buildBrowserImportSet(source, userId);
        const saved = await saveSet(prepared);
        if (!saved || saved.id !== prepared.id) throw new Error('Cloud save changed the imported dice-set id.');
        const index = nextCloudSets.findIndex((set) => set.id === saved.id);
        if (index >= 0) nextCloudSets[index] = cloneDiceSet(saved); else nextCloudSets.unshift(cloneDiceSet(saved));
        imported.push({ sourceId: source.id, set: cloneDiceSet(saved) });
      } catch (error) {
        console.error(`Failed to import browser dice set ${source?.id || 'unknown'}:`, error);
        failures.push({ id: source?.id || null, message: error?.message || 'Import failed.' });
      }
    }
    return { cloudSets: nextCloudSets, imported, pending: getImportableBrowserSets(browserSets, nextCloudSets), failures };
  } catch (error) {
    console.error('Browser dice-set import failed:', error);
    throw error;
  }
}
