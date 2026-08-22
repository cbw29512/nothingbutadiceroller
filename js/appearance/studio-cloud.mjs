import { validateDiceSet } from './validation.mjs';

async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Dice-set request failed.');
    error.code = data.code || null;
    error.record = data.record || null;
    error.version = data.version ?? null;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function validSetsFromRecords(records = []) {
  try {
    if (!Array.isArray(records)) return [];
    return records.map((record) => record?.set).filter((set) => {
      if (!set) return false;
      const validation = validateDiceSet(set);
      if (!validation.ok) console.warn(`Skipping invalid stored dice set ${set?.id || 'unknown'}.`, validation.errors);
      return validation.ok;
    });
  } catch (error) {
    console.error('Failed to validate loaded dice sets:', error);
    return [];
  }
}

export async function loadCloudDiceSets() {
  try {
    const response = await fetch('/api/dice-sets', { credentials: 'include' });
    if (response.status === 401) return { authenticated: false, userId: null, sets: [], versions: {} };
    const data = await parse(response);
    return {
      authenticated: true,
      userId: data.userId || null,
      sets: validSetsFromRecords(data.records),
      versions: data.versions && typeof data.versions === 'object' ? data.versions : {},
    };
  } catch (error) {
    console.error('Failed to load cloud dice sets:', error);
    return { authenticated: false, userId: null, sets: [], versions: {}, error };
  }
}

export async function loadCommunityDiceSets() {
  try {
    const response = await fetch('/api/dice-sets?scope=community', { credentials: 'include' });
    const data = await parse(response);
    return validSetsFromRecords(data.records);
  } catch (error) {
    console.error('Failed to load community dice sets:', error);
    return [];
  }
}

export async function saveCloudDiceSet(set, version = null) {
  const response = await fetch('/api/save-dice-set', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set, version }),
  });
  const data = await parse(response);
  return {
    set: data.record?.set || set,
    version: data.version ?? null,
    warning: data.warning || null,
  };
}

export async function deleteCloudDiceSet(setId, version) {
  const response = await fetch(`/api/dice-sets?id=${encodeURIComponent(setId)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: version ? { 'If-Match': version } : {},
  });
  await parse(response);
  return true;
}
