import { createUserDiceSet, cloneDiceSet } from './schema.mjs';

export function getImportableBrowserSets(browserSets = [], cloudSets = []) {
  try {
    const cloudIds = new Set((cloudSets || []).map((set) => set?.id).filter(Boolean));
    return (browserSets || [])
      .filter((set) => set && !set.systemOwned && !cloudIds.has(set.id))
      .map(cloneDiceSet);
  } catch (error) {
    console.error('Failed to resolve importable browser dice sets:', error);
    return [];
  }
}

export function buildBrowserImportSet(source, userId) {
  try {
    if (!source || source.systemOwned) throw new Error('A browser-owned dice set is required.');
    return createUserDiceSet({ id: source.id, ownerId: userId, name: source.name, appearance: source.appearance });
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
        const saved = await saveSet(buildBrowserImportSet(source, userId));
        const index = nextCloudSets.findIndex((set) => set.id === saved.id);
        if (index >= 0) nextCloudSets[index] = cloneDiceSet(saved); else nextCloudSets.unshift(cloneDiceSet(saved));
        imported.push(cloneDiceSet(saved));
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
