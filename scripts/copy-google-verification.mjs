import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const token = (process.env.GOOGLE_SITE_VERIFICATION || '').trim();
const indexPath = resolve('dist', 'index.html');

try {
  if (!token) {
    console.log('Google site verification token not configured; skipping meta injection.');
    process.exit(0);
  }

  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('GOOGLE_SITE_VERIFICATION contains unsupported characters.');
  }

  let html = await readFile(indexPath, 'utf8');
  const meta = `<meta name="google-site-verification" content="${token}">`;
  const existing = /<meta\s+name=["']google-site-verification["'][^>]*>/i;

  if (existing.test(html)) {
    html = html.replace(existing, meta);
  } else {
    html = html.replace('</head>', `  ${meta}\n</head>`);
  }

  await writeFile(indexPath, html, 'utf8');
  console.log('Google site verification meta tag injected into dist/index.html.');
} catch (error) {
  console.error('Google verification meta injection failed:', error);
  process.exitCode = 1;
}
