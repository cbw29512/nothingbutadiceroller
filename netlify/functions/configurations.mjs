import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { DIE_SKINS, TRAY_THEMES } from '../../js/utils.js';
import { openScopedStore } from './deploy-store.mjs';

const STORE_NAME = 'dice-user-configurations';
const VALID_DICE = new Set(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
const VALID_TRAY_THEMES = new Set(TRAY_THEMES.map((theme) => theme.id));
const VALID_DIE_SKINS = new Set(DIE_SKINS.map((skin) => skin.id));
const MAX_CONFIGS = 50;
const DEFAULT_TRAY = 'tray-green_felt';
const DEFAULT_SKIN = 'skin-ruby_red';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function configKey(userId) { return `users/${encodeURIComponent(String(userId))}/configurations.json`; }
function safeChoice(value, allowed, fallback) {
  const text = String(value || '');
  return allowed.has(text) ? text : fallback;
}
function sanitizeDice(selectedDice) {
  if (!Array.isArray(selectedDice)) return [];
  return selectedDice.filter((die) => VALID_DICE.has(die?.type)).slice(0, 100).map((die) => ({ type: die.type }));
}
function sanitizeAppearance(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
  const imageUrl = String(raw.imageUrl || '');
  return {
    themeId: String(raw.themeId || '').slice(0, 120),
    ownerId: String(raw.ownerId || '').slice(0, 120),
    name: String(raw.name || 'Custom Theme').slice(0, 80),
    trayName: String(raw.trayName || 'Custom Tray').slice(0, 80),
    trayColor: hex(raw.trayColor, '#0f172a'),
    diceColor: hex(raw.diceColor, '#b91c1c'),
    imageUrl: imageUrl.startsWith('/api/theme-image?') ? imageUrl : null,
    enableGlow: Boolean(raw.enableGlow),
    glowColor: hex(raw.glowColor, '#00ff66'),
    isPublic: Boolean(raw.isPublic),
  };
}
function normalizeFields(body) {
  const name = String(body?.name || '').trim().slice(0, 60);
  if (!name) throw new Error('Configuration name is required.');
  return {
    name,
    selectedDice: sanitizeDice(body?.selectedDice),
    trayTheme: safeChoice(body?.trayTheme, VALID_TRAY_THEMES, DEFAULT_TRAY),
    dieSkin: safeChoice(body?.dieSkin, VALID_DIE_SKINS, DEFAULT_SKIN),
    customAppearance: sanitizeAppearance(body?.customAppearance),
    keepDice: Boolean(body?.keepDice),
    isDefault: Boolean(body?.isDefault),
  };
}
function sanitizeStoredConfiguration(raw) {
  if (!raw || typeof raw !== 'object') return null;
  try {
    return {
      id: String(raw.id || '').slice(0, 120),
      ...normalizeFields({ ...raw, name: raw.name || 'Saved Configuration' }),
      createdAt: raw.createdAt || null,
      updatedAt: raw.updatedAt || null,
    };
  } catch (error) {
    console.warn('Skipping invalid saved configuration:', error);
    return null;
  }
}
async function readConfigurations(store, userId) {
  try {
    const raw = await store.get(configKey(userId), { type: 'json' });
    return Array.isArray(raw) ? raw.map(sanitizeStoredConfiguration).filter(Boolean).slice(0, MAX_CONFIGS) : [];
  } catch (error) {
    console.error('Failed to read saved configurations:', error);
    throw new Error('Unable to read saved configurations.');
  }
}

export default async (request, context) => {
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);
    const store = openScopedStore(STORE_NAME, context);
    const url = new URL(request.url);
    const configurations = await readConfigurations(store, user.id);

    if (request.method === 'GET') return json({ configurations });
    if (request.method === 'POST') {
      verifyRequestOrigin(request);
      const body = await request.json();
      const normalized = normalizeFields(body);
      const now = new Date().toISOString();
      const requestedId = typeof body?.id === 'string' ? body.id : '';
      const existingIndex = requestedId ? configurations.findIndex((item) => item.id === requestedId) : -1;
      if (existingIndex < 0 && configurations.length >= MAX_CONFIGS) {
        return json({ error: `Maximum of ${MAX_CONFIGS} saved configurations reached.` }, 400);
      }
      if (normalized.isDefault) configurations.forEach((item) => { item.isDefault = false; });
      let saved;
      if (existingIndex >= 0) {
        saved = { ...configurations[existingIndex], ...normalized, updatedAt: now };
        configurations[existingIndex] = saved;
      } else {
        saved = { id: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...normalized, createdAt: now, updatedAt: now };
        configurations.unshift(saved);
      }
      await store.setJSON(configKey(user.id), configurations);
      return json({ configuration: saved, configurations });
    }
    if (request.method === 'DELETE') {
      verifyRequestOrigin(request);
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'Configuration id is required.' }, 400);
      const next = configurations.filter((item) => item.id !== id);
      if (next.length === configurations.length) return json({ error: 'Configuration not found.' }, 404);
      await store.setJSON(configKey(user.id), next);
      return json({ success: true, configurations: next });
    }
    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    const status = Number(error?.status || error?.statusCode) || 500;
    if (status === 403) return json({ error: 'Request origin is not allowed.' }, 403);
    console.error('Configuration API failed:', error);
    return json({ error: error?.message || 'Configuration request failed.' }, status >= 400 && status < 600 ? status : 500);
  }
};
export const config = { path: '/api/configurations' };
