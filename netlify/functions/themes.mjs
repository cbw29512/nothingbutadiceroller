import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';

const STORE_NAME = 'dice-trays-store';

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

export default async (request) => {
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.' }, 401);

    const store = getStore(STORE_NAME);
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const requestedId = url.searchParams.get('id');
      if (requestedId) {
        const theme = await store.get(themeKey(user.id, requestedId), { type: 'json' });
        if (!theme) return json({ error: 'Theme not found.' }, 404);
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
