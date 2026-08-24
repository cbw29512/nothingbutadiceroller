import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { decodeRuntimeThemePayload } from '../../js/appearance/runtime-theme-codec.mjs';
import { buildRuntimeThemeConfig, buildRuntimeThemeSvg } from '../../js/appearance/runtime-theme-response.mjs';

const PRODUCTION_CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' https://app.netlify.com; frame-ancestors 'self' https://app.netlify.com";
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

function commonHeaders() {
  return {
    'Content-Security-Policy': PRODUCTION_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

function json(response, body, status = 200, extraHeaders = {}) {
  response.writeHead(status, {
    ...commonHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function runtimeThemeApi(url, response) {
  const match = url.pathname.match(/^\/api\/dice-theme\/([^/]+)\/(theme\.config\.json|diffuse\.svg)$/);
  if (!match) return false;
  try {
    const payload = decodeRuntimeThemePayload(match[1]);
    if (match[2] === 'theme.config.json') {
      json(response, buildRuntimeThemeConfig(payload), 200, { 'Cache-Control': 'public, max-age=31536000, immutable' });
      return true;
    }
    response.writeHead(200, {
      ...commonHeaders(),
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    response.end(buildRuntimeThemeSvg(payload));
    return true;
  } catch (error) {
    console.error('Built-site runtime theme request failed:', url.pathname, error?.message || error);
    json(response, { error: 'Invalid runtime dice theme.' }, 400);
    return true;
  }
}

function stubApi(url, response) {
  if (runtimeThemeApi(url, response)) return true;
  if (url.pathname === '/api/dice-sets' && url.searchParams.get('scope') === 'community') {
    json(response, { records: [] });
    return true;
  }
  if (url.pathname.startsWith('/api/')) {
    json(response, { error: 'Authentication required.' }, 401);
    return true;
  }
  return false;
}

function safeTarget(dist, pathname) {
  const decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const target = resolve(dist, `.${decoded}`);
  if (target !== dist && !target.startsWith(`${dist}${sep}`)) return null;
  return target;
}

export async function startBuiltSiteServer(dist) {
  const server = createServer(async (request, response) => {
    let requestPath = request.url || '/';
    try {
      const url = new URL(requestPath, 'http://127.0.0.1');
      requestPath = url.pathname;
      if (url.pathname === '/favicon.ico') {
        response.writeHead(301, { ...commonHeaders(), Location: '/favicon.svg' });
        response.end();
        return;
      }
      if (stubApi(url, response)) return;
      const target = safeTarget(dist, url.pathname);
      if (!target) {
        response.writeHead(403, commonHeaders());
        response.end('Forbidden');
        return;
      }
      const data = await readFile(target);
      response.writeHead(200, {
        ...commonHeaders(),
        'Content-Type': MIME.get(extname(target).toLowerCase()) || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(data);
    } catch (error) {
      console.error('Built-site test server request failed:', requestPath, error?.code || error?.name || 'unknown-error');
      response.writeHead(404, { ...commonHeaders(), 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
    }
  });

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });

  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise)),
  };
}
