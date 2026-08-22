import { getUser, verifyRequestOrigin } from '@netlify/identity';
import {
  LEGACY_THEME_COMMUNITY_INDEX,
  legacyThemeIndexKey,
  legacyThemeKey,
  openLegacyThemeStore,
  readLegacyCommunityIndex,
  toPublicLegacyTheme,
} from './legacy-theme-store.mjs';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
async function readIndex(store, userId) {
  const value = await store.get(legacyThemeIndexKey(userId), { type: 'json' }).catch(() => []);
  return Array.isArray(value) ? value : [];
}
async function readMine(store, userId) {
  const index = await readIndex(store, userId);
  const themes = await Promise.all(index.map((item) => (
    item?.themeId ? store.get(legacyThemeKey(userId, item.themeId), { type: 'json' }).catch(() => null) : null
  )));
  return themes.filter(Boolean);
}
async function readCommunity(store) {
  const index = await readLegacyCommunityIndex(store);
  const themes = await Promise.all(index.map((item) => (
    item?.ownerId && item?.themeId
      ? store.get(legacyThemeKey(item.ownerId, item.themeId), { type: 'json' }).catch(() => null)
      : null
  )));
  return themes.map(toPublicLegacyTheme).filter(Boolean);
}
async function bestEffortSet(store, key, value, label) {
  try { await store.setJSON(key, value); }
  catch (error) { console.warn(`Failed to clean legacy ${label}:`, error); }
}
async function bestEffortDelete(store, key, label) {
  if (!key) return;
  try { await store.delete(key); }
  catch (error) { console.warn(`Failed to clean legacy ${label}:`, error); }
}

export default async (request, context) => {
  try {
    const store = openLegacyThemeStore(context);
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'mine';
    if (request.method === 'GET' && scope === 'community') {
      return json({ themes: await readCommunity(store) });
    }

    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);
    if (request.method === 'GET') {
      const requestedId = url.searchParams.get('id');
      if (requestedId) {
        const theme = await store.get(legacyThemeKey(user.id, requestedId), { type: 'json' }).catch(() => null);
        return theme ? json({ theme }) : json({ error: 'Theme not found.' }, 404);
      }
      return json({ themes: await readMine(store, user.id) });
    }
    if (request.method === 'DELETE') {
      verifyRequestOrigin(request);
      const themeId = url.searchParams.get('id');
      if (!themeId) return json({ error: 'Theme id is required.' }, 400);
      const key = legacyThemeKey(user.id, themeId);
      const existing = await store.get(key, { type: 'json' }).catch(() => null);
      if (!existing) return json({ error: 'Theme not found.' }, 404);

      await store.delete(key);
      await bestEffortDelete(store, existing.imageKey, 'theme image');
      const index = await readIndex(store, user.id);
      await bestEffortSet(store, legacyThemeIndexKey(user.id), index.filter((item) => item.themeId !== themeId), 'user index');
      if (existing.isPublic) {
        const community = await readLegacyCommunityIndex(store);
        await bestEffortSet(
          store,
          LEGACY_THEME_COMMUNITY_INDEX,
          community.filter((item) => !(item.ownerId === user.id && item.themeId === themeId)),
          'community index',
        );
      }
      return json({ success: true });
    }
    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    const status = Number(error?.status || error?.statusCode) || 500;
    if (status === 403) return json({ error: 'Request origin is not allowed.' }, 403);
    console.error('Themes API failed:', error);
    return json({ error: error?.message || 'Theme request failed.' }, status >= 400 && status < 600 ? status : 500);
  }
};

export const config = { path: '/api/themes' };
