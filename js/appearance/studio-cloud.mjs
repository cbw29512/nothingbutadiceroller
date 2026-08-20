async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Dice-set request failed.');
  return data;
}

export async function loadCloudDiceSets() {
  try {
    const response = await fetch('/api/dice-sets', { credentials: 'include' });
    if (response.status === 401) return { authenticated: false, userId: null, sets: [] };
    const data = await parse(response);
    return {
      authenticated: true,
      userId: data.userId || null,
      sets: Array.isArray(data.records) ? data.records.map((record) => record.set).filter(Boolean) : [],
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
    return Array.isArray(data.records) ? data.records.map((record) => record.set).filter(Boolean) : [];
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
