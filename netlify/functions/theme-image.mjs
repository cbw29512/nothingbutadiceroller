import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';

const STORE_NAME = 'dice-trays-store';

function themeKey(ownerId, themeId) {
  return `users/${ownerId}/themes/${themeId}.json`;
}

export default async (request) => {
  try {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

    const url = new URL(request.url);
    const ownerId = String(url.searchParams.get('owner') || '');
    const themeId = String(url.searchParams.get('theme') || '');
    const token = String(url.searchParams.get('token') || '');
    if (!ownerId || !themeId) return new Response('Missing theme', { status: 400 });

    const store = getStore(STORE_NAME);
    const theme = await store.get(themeKey(ownerId, themeId), { type: 'json' });
    if (!theme?.imageKey) return new Response('Image not found', { status: 404 });

    const hasCapability = Boolean(theme.imageAccessToken) && token === theme.imageAccessToken;
    if (!hasCapability) {
      const user = await getUser();
      if (!user || user.id !== ownerId) return new Response('Unauthorized', { status: 401 });
    }

    const entry = await store.getWithMetadata(theme.imageKey, { type: 'arrayBuffer' });
    if (!entry?.data) return new Response('Image not found', { status: 404 });

    return new Response(entry.data, {
      headers: {
        'Content-Type': entry.metadata?.contentType || 'image/png',
        'Cache-Control': theme.isPublic ? 'public, max-age=86400' : 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Theme image request failed:', error);
    return new Response('Unable to load theme image', { status: 500 });
  }
};

export const config = {
  path: '/api/theme-image',
};
