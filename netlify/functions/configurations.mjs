import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';

const STORE_NAME = 'dice-user-configurations';
const VALID_DICE = new Set(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
const MAX_CONFIGS = 50;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function configKey(userId) {
  return `users/${userId}/configurations.json`;
}

async function readConfigurations(store, userId) {
  try {
    const raw = await store.get(configKey(userId), { type: 'json' });
    return Array.isArray(raw) ? raw : [];
  } catch (error) {
    console.error('Failed to read saved configurations:', error);
    return [];
  }
}

function sanitizeDice(selectedDice) {
  if (!Array.isArray(selectedDice)) return [];
  return selectedDice
    .filter((die) => VALID_DICE.has(die?.type))
    .slice(0, 100)
    .map((die) => ({ type: die.type }));
}

function normalizeIncoming(body) {
  const name = String(body?.name || '').trim().slice(0, 60);
  if (!name) throw new Error('Configuration name is required.');

  return {
    name,
    selectedDice: sanitizeDice(body?.selectedDice),
    trayTheme: String(body?.trayTheme || 'tray-green_felt').slice(0, 80),
    dieSkin: String(body?.dieSkin || 'skin-ruby_red').slice(0, 80),
    keepDice: Boolean(body?.keepDice),
    isDefault: Boolean(body?.isDefault),
  };
}

export default async (request) => {
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const store = getStore(STORE_NAME);
    const url = new URL(request.url);
    const configurations = await readConfigurations(store, user.id);

    if (request.method === 'GET') {
      return json({ configurations });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const normalized = normalizeIncoming(body);
      const now = new Date().toISOString();
      const requestedId = typeof body?.id === 'string' ? body.id : '';
      const existingIndex = requestedId
        ? configurations.findIndex((item) => item.id === requestedId)
        : -1;

      if (existingIndex < 0 && configurations.length >= MAX_CONFIGS) {
        return json({ error: `Maximum of ${MAX_CONFIGS} saved configurations reached.` }, 400);
      }

      if (normalized.isDefault) {
        configurations.forEach((item) => { item.isDefault = false; });
      }

      let saved;
      if (existingIndex >= 0) {
        saved = {
          ...configurations[existingIndex],
          ...normalized,
          updatedAt: now,
        };
        configurations[existingIndex] = saved;
      } else {
        saved = {
          id: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          ...normalized,
          createdAt: now,
          updatedAt: now,
        };
        configurations.unshift(saved);
      }

      await store.setJSON(configKey(user.id), configurations);
      return json({ configuration: saved, configurations });
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'Configuration id is required.' }, 400);

      const next = configurations.filter((item) => item.id !== id);
      if (next.length === configurations.length) {
        return json({ error: 'Configuration not found.' }, 404);
      }

      await store.setJSON(configKey(user.id), next);
      return json({ success: true, configurations: next });
    }

    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    console.error('Configuration API failed:', error);
    return json({ error: error?.message || 'Configuration request failed.' }, 500);
  }
};

export const config = {
  path: '/api/configurations',
};
