import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate } from './browser/chromium.mjs';
import { assertSkipNavigation } from './browser/main-interactions.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    await navigate(browser.client, `${server.origin}/`, { width: 1440, height: 900, mobile: false });
    await assertSkipNavigation(browser.client);
    console.log('Skip navigation browser test passed: keyboard focus reveals the bypass link and activation moves focus to the roller landmark.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Skip navigation browser test failed:', error);
  process.exitCode = 1;
});
