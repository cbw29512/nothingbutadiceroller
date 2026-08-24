import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const mobile = { name: 'mobile', width: 390, height: 844, mobile: true };

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    const client = browser.client;
    await navigate(client, `${server.origin}/`, mobile);
    await waitFor(client, "document.querySelector('#mobile-custom-die-btn') && document.querySelector('#custom-die-roll-btn')");

    await client.evaluate("document.querySelector('#mobile-custom-die-btn')?.click()");
    await waitFor(client, "document.querySelector('#mobile-custom-die-btn')?.getAttribute('aria-expanded') === 'true'");
    await client.evaluate(`(() => {
      const input = document.querySelector('#custom-die-sides');
      input.value = '37';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#custom-die-roll-btn')?.click();
    })()`);
    await waitFor(client, "document.querySelector('.custom-roll-display') && document.querySelector('#breakdown-text')?.textContent.includes('Secure random')", 10000);

    const state = await client.evaluate(`(() => {
      const proof = document.querySelector('.custom-random-proof');
      const summary = proof?.querySelector('summary');
      const rect = summary?.getBoundingClientRect();
      return {
        total: Number(document.querySelector('#total-result')?.textContent),
        caption: document.querySelector('.custom-result-caption')?.textContent.trim() || '',
        breakdown: document.querySelector('#breakdown-text')?.textContent.trim() || '',
        aria: document.querySelector('.custom-roll-display')?.getAttribute('aria-label') || '',
        proofOpen: Boolean(proof?.open),
        summary: summary?.textContent.trim() || '',
        proofText: proof?.querySelector('p')?.textContent.trim() || '',
        summaryHeight: rect?.height || 0,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    })()`);

    assert.ok(state.total >= 1 && state.total <= 37, `Custom d37 result must stay within 1-37; received ${state.total}.`);
    assert.equal(state.caption, 'Secure random • range 1–37');
    assert.match(state.breakdown, /^Custom d37 = \d+ • Secure random • range 1–37$/);
    assert.doesNotMatch(state.breakdown, /CSPRNG|rejection sampling/i);
    assert.match(state.aria, /Secure random range 1 through 37/i);
    assert.equal(state.proofOpen, false, 'Technical proof should remain collapsed by default.');
    assert.equal(state.summary, 'How randomness works');
    assert.match(state.proofText, /Web Crypto CSPRNG/i);
    assert.match(state.proofText, /rejection sampling/i);
    assert.ok(state.summaryHeight >= 44, `Randomness proof target must be at least 44px; got ${state.summaryHeight}.`);
    assert.equal(state.overflow, false, 'Custom-result proof must not introduce horizontal overflow.');

    await client.evaluate("document.querySelector('.custom-random-proof summary')?.click()");
    await waitFor(client, "document.querySelector('.custom-random-proof')?.open === true");
    assert.match(await client.evaluate("document.querySelector('.custom-random-proof p')?.textContent || ''"), /every result from 1 through 37 the same chance/i);

    console.log('Custom die presentation passed: table-facing result copy is concise, secure-random proof remains accessible on demand, target size is mobile-safe, and the CSPRNG/rejection-sampling implementation remains exposed without cluttering the main result.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Custom die presentation audit failed:', error);
  process.exitCode = 1;
});
