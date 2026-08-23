import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

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

function json(response, body, status = 200) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function stubApi(url, response) {
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
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (stubApi(url, response)) return;
      const target = safeTarget(dist, url.pathname);
      if (!target) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      const data = await readFile(target);
      response.writeHead(200, {
        'Content-Type': MIME.get(extname(target).toLowerCase()) || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(data);
    } catch (error) {
      console.error('Built-site test server request failed:', error?.code || error?.name || 'unknown-error');
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
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