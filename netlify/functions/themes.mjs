import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';

const STORE_NAME = 'dice-trays-store';
const COMMUNITY_INDEX = 'community/themes/index.json';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function indexKey(userId) {
  return `users/${userId}/themes/index.json`;
}

function themeKey(userId, themeId) {
  return `users/${userId}/themes/${themeId}.json`;
}

async function readIndex(store, userId) {
  const index = await store.get(indexKey(userId), { type: 'json' });
  return Array.isArray(index) ? index : [];
}

async function readCommunity(store) {
  const index = await store.get(COMMUNITY_INDEX, { type: 'json' });
  return Array.isArray(index) ? index : [];
}

export default async (request) => {
  try {
    const store = getStore(STORE_NAME);
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'mine';
    const user = await getUser();

    if (request.method === 'GET' && scope === 'community') {
      const index = await readCommunity(store);
      const themes = (await Promise.all(
        index.map((item) => store.get(themeKey(item.ownerId, item.themeId), { type: 'json' }))
      )).filter((theme) => theme?.isPublic);
      return json({ themes });
    }

    if (!user) return json({ error: 'Authentication required.' }, 401);

    if (request.method === 'GET') {
      const requestedId = url.searchParams.get('id');
      const ownerId = url.searchParams.get('owner') || user.id;

      if (requestedId) {
        const theme = await store.get(themeKey(ownerId, requestedId), { type: 'json' });
        if (!theme) return json({ error: 'Theme not found.' }, 404);
        if (ownerId !== user.id && !theme.isPublic) {
          return json({ error: 'Theme is private.' }, 403);
        }
        return json({ theme });
      }

      const index = await readIndex(store, user.id);
      const themes = (await Promise.all(
        index.map((item) => store.get(themeKey(user.id, item.themeId), { type: 'json' }))
      )).filter(Boolean);
      return json({ themes });
    }

    if (request.method === 'DELETE') {
      const themeId = url.searchParams.get('id');
      if (!themeId) return json({ error: 'Theme id is required.' }, 400);

      const existing = await store.get(themeKey(user.id, themeId), { type: 'json' });
      if (!existing) return json({ error: 'Theme not found.' }, 404);

      await store.delete(themeKey(user.id, themeId));
      const index = await readIndex(store, user.id);
      const next = index.filter((item) => item.themeId !== themeId);
      await store.setJSON(indexKey(user.id), next);

      if (existing.isPublic) {
        const community = await readCommunity(store);
        await store.setJSON(
          COMMUNITY_INDEX,
          community.filter((item) => !(item.ownerId === user.id && item.themeId === themeId))
        );
      }

      return json({ success: true });
    }

    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    console.error('Themes API failed:', error);
    return json({ error: error?.message || 'Theme request failed.' }, 500);
  }
};

export const config = {
  path: '/api/themes',
};
