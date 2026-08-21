import { validateDiceSet } from './validation.mjs';

async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Dice-set request failed.');
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
    if (response.status === 401) return { authenticated: false, userId: null, sets: [] };
    const data = await parse(response);
    return {
      authenticated: true,
      userId: data.userId || null,
      sets: validSetsFromRecords(data.records),
    };
  } catch (error) {
    console.error('Failed to load cloud dice sets:', error);
    return { authenticated: false, userId: null, sets: [], error };
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

export async function saveCloudDiceSet(set) {
  const response = await fetch('/api/save-dice-set', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set }),
  });
  const data = await parse(response);
  return data.record?.set || set;
}

export async function deleteCloudDiceSet(setId) {
  const response = await fetch(`/api/dice-sets?id=${encodeURIComponent(setId)}`, {
    method: 'DELETE', credentials: 'include',
  });
  await parse(response);
  return true;
}
