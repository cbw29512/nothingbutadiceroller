import { decodeRuntimeThemePayload } from '../../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeConfig, buildRuntimeThemeSvg } from '../../js/appearance/runtime-theme-response.mjs';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
};

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { ...CACHE_HEADERS, ...headers } });
}

export default async (request, context) => {
  if (request.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405, { 'Cache-Control': 'no-store' });
  try {
    const token = context?.params?.token || '';
    const asset = context?.params?.asset || '';
    const payload = decodeRuntimeThemePayload(token);
    if (asset === 'theme.config.json') return json(buildRuntimeThemeConfig(payload));
    if (asset === 'diffuse.svg') {
      return new Response(buildRuntimeThemeSvg(payload), {
        status: 200,
        headers: { ...CACHE_HEADERS, 'Content-Type': 'image/svg+xml; charset=utf-8' },
      });
    }
    return json({ error: 'Theme asset not found.' }, 404, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Runtime dice theme asset request failed:', error);
    return json({ error: 'Invalid runtime dice theme.' }, 400, { 'Cache-Control': 'no-store' });
  }
};

export const config = {
  path: '/api/dice-theme/:token/:asset',
  method: 'GET',
};
