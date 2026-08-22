import { getUser } from '@netlify/identity';
import {
  legacyThemeKey,
  openLegacyThemeStore,
  resolveLegacyPublicTheme,
} from './legacy-theme-store.mjs';

export default async (request, context) => {
  try {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    const publicId = String(url.searchParams.get('public') || '');
    const ownerId = String(url.searchParams.get('owner') || '');
    const themeId = String(url.searchParams.get('theme') || '');
    const token = String(url.searchParams.get('token') || '');
    const store = openLegacyThemeStore(context);

    let theme = null;
    if (publicId) {
      theme = await resolveLegacyPublicTheme(store, publicId);
      const validCapability = theme?.isPublic
        && Boolean(theme.imageAccessToken)
        && token === theme.imageAccessToken;
      if (!validCapability) return new Response('Unauthorized', { status: 401 });
    } else {
      if (!ownerId || !themeId) return new Response('Missing theme', { status: 400 });
      theme = await store.get(legacyThemeKey(ownerId, themeId), { type: 'json' }).catch(() => null);
      if (!theme?.imageKey) return new Response('Image not found', { status: 404 });
      const legacyPublicCapability = theme.isPublic
        && Boolean(theme.imageAccessToken)
        && token === theme.imageAccessToken;
      if (!legacyPublicCapability) {
        const user = await getUser();
        if (!user || user.id !== ownerId) return new Response('Unauthorized', { status: 401 });
      }
    }

    if (!theme?.imageKey) return new Response('Image not found', { status: 404 });
    const entry = await store.getWithMetadata(theme.imageKey, { type: 'arrayBuffer' });
    if (!entry?.data) return new Response('Image not found', { status: 404 });
    return new Response(entry.data, {
      headers: {
        'Content-Type': entry.metadata?.contentType || 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Theme image request failed:', error);
    return new Response('Unable to load theme image', { status: 500 });
  }
};

export const config = { path: '/api/theme-image' };
