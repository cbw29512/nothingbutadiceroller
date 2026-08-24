import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { DIE_SKINS, TRAY_THEMES } from '../../js/utils.js';
import { apiErrorResponse, publicError } from './api-errors.mjs';
import {
  configurationConflict, normalizeConfigurationVersion,
  readVersionedConfigurations, writeVersionedConfigurations,
} from './configuration-concurrency.mjs';
import { configurationKey, openConfigurationStore } from './user-data-store.mjs';

const VALID_DICE = new Set(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
const VALID_TRAY_THEMES = new Set(TRAY_THEMES.map((theme) => theme.id));
const VALID_DIE_SKINS = new Set(DIE_SKINS.map((skin) => skin.id));
const MAX_CONFIGS = 50;
const DEFAULT_TRAY = 'tray-green_felt';
const DEFAULT_SKIN = 'skin-ruby_red';

function json(body, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
function safeChoice(value, allowed, fallback) { const text = String(value || ''); return allowed.has(text) ? text : fallback; }
function sanitizeDice(selectedDice) {
  if (!Array.isArray(selectedDice)) return [];
  return selectedDice.filter((die) => VALID_DICE.has(die?.type)).slice(0, 100).map((die) => ({ type: die.type }));
}
function sanitizeAppearance(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
  const imageUrl = String(raw.imageUrl || '');
  return {
    themeId: String(raw.themeId || '').slice(0, 120), ownerId: String(raw.ownerId || '').slice(0, 120),
    name: String(raw.name || 'Custom Theme').slice(0, 80), trayName: String(raw.trayName || 'Custom Tray').slice(0, 80),
    trayColor: hex(raw.trayColor, '#0f172a'), diceColor: hex(raw.diceColor, '#b91c1c'),
    imageUrl: imageUrl.startsWith('/api/theme-image?') ? imageUrl : null,
    enableGlow: Boolean(raw.enableGlow), glowColor: hex(raw.glowColor, '#00ff66'), isPublic: Boolean(raw.isPublic),
  };
}
function normalizeFields(body) {
  const name = String(body?.name || '').trim().slice(0, 60);
  if (!name) throw publicError('Configuration name is required.', { code: 'configuration-name-required' });
  return {
    name, selectedDice: sanitizeDice(body?.selectedDice), trayTheme: safeChoice(body?.trayTheme, VALID_TRAY_THEMES, DEFAULT_TRAY),
    dieSkin: safeChoice(body?.dieSkin, VALID_DIE_SKINS, DEFAULT_SKIN), customAppearance: sanitizeAppearance(body?.customAppearance),
    keepDice: Boolean(body?.keepDice), isDefault: Boolean(body?.isDefault),
  };
}
function sanitizeStoredConfiguration(raw) {
  if (!raw || typeof raw !== 'object') return null;
  try {
    return {
      id: String(raw.id || '').slice(0, 120), ...normalizeFields({ ...raw, name: raw.name || 'Saved Configuration' }),
      createdAt: raw.createdAt || null, updatedAt: raw.updatedAt || null,
    };
  } catch (error) {
    console.warn('Skipping invalid saved configuration:', error);
    return null;
  }
}
export function projectConfigurations(raw = []) {
  return Array.isArray(raw) ? raw.map(sanitizeStoredConfiguration).filter(Boolean).slice(0, MAX_CONFIGS) : [];
}
async function requestJson(request) {
  try { return await request.json(); }
  catch { throw publicError('Request body must be valid JSON.', { code: 'invalid-json' }); }
}

export default async (request, context) => {
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.', code: 'authentication-required' }, 401);
    const store = openConfigurationStore(context);
    const key = configurationKey(user.id);
    const snapshot = await readVersionedConfigurations(store, key);
    const configurations = projectConfigurations(snapshot.configurations);
    const url = new URL(request.url);

    if (request.method === 'GET') return json({ configurations, version: snapshot.version });
    if (request.method === 'POST') {
      verifyRequestOrigin(request);
      const body = await requestJson(request);
      if (!Object.prototype.hasOwnProperty.call(body || {}, 'version')) {
        throw publicError('Saved-configuration version is required. Reload your account data.', { code: 'configuration-version-required' });
      }
      const expectedVersion = normalizeConfigurationVersion(body.version);
      if (expectedVersion !== snapshot.version) throw configurationConflict(snapshot, projectConfigurations);
      const normalized = normalizeFields(body);
      const now = new Date().toISOString();
      const requestedId = typeof body?.id === 'string' ? body.id : '';
      const existingIndex = requestedId ? configurations.findIndex((item) => item.id === requestedId) : -1;
      if (existingIndex < 0 && configurations.length >= MAX_CONFIGS) {
        throw publicError(`Maximum of ${MAX_CONFIGS} saved configurations reached.`, { code: 'configuration-limit-reached' });
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
      const version = await writeVersionedConfigurations(store, key, configurations, expectedVersion, { project: projectConfigurations });
      return json({ configuration: saved, configurations, version });
    }
    if (request.method === 'DELETE') {
      verifyRequestOrigin(request);
      const expectedVersion = normalizeConfigurationVersion(request.headers.get('If-Match'));
      if (expectedVersion !== snapshot.version) throw configurationConflict(snapshot, projectConfigurations);
      const id = url.searchParams.get('id');
      if (!id) throw publicError('Configuration id is required.', { code: 'configuration-id-required' });
      const next = configurations.filter((item) => item.id !== id);
      if (next.length === configurations.length) throw publicError('Configuration not found.', { status: 404, code: 'configuration-not-found' });
      const version = await writeVersionedConfigurations(store, key, next, expectedVersion, { project: projectConfigurations });
      return json({ success: true, configurations: next, version });
    }
    return json({ error: 'Method Not Allowed', code: 'method-not-allowed' }, 405);
  } catch (error) {
    if (error?.name !== 'PublicApiError') console.error('Configuration API failed:', error);
    const safe = apiErrorResponse(error, 'Configuration request failed.');
    return json(safe.body, safe.status);
  }
};
export const config = { path: '/api/configurations' };
