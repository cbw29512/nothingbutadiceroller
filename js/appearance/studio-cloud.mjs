import { validateDiceSet } from './validation.mjs';

async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Dice-set request failed.');
    error.code = data.code || null;
    error.record = data.record || null;
    error.version = data.version ?? null;
    error.details = data.details ?? null;
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

export async function loadCommunityDiceSetPage(page = 1, pageSize = 24) {
  try {
    const params = new URLSearchParams({ scope: 'community', page: String(page), pageSize: String(pageSize) });
    const response = await fetch(`/api/dice-sets?${params}`, { credentials: 'include' });
    const data = await parse(response);
    return {
      sets: validSetsFromRecords(data.records),
      page: Number.isInteger(data.page) ? data.page : page,
      pageSize: Number.isInteger(data.pageSize) ? data.pageSize : pageSize,
      hasMore: data.hasMore === true,
    };
  } catch (error) {
    console.error('Failed to load Community dice-set page:', error);
    return { sets: [], page, pageSize, hasMore: false, error };
  }
}

export async function loadCommunityDiceSets() {
  try {
    const result = await loadCommunityDiceSetPage();
    return result.sets;
  } catch (error) {
    console.error('Failed to load community dice sets:', error);
    return [];
  }
}

export async function submitCommunityReport({ publicAccessId, reason, details = '' }) {
  try {
    const response = await fetch('/api/community-report', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicAccessId, reason, details }),
    });
    return await parse(response);
  } catch (error) {
    console.error('Failed to submit Community report:', error);
    throw error;
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
