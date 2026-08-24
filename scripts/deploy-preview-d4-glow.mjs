import assert from 'node:assert/strict';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').trim().replace(/\/$/, '');
if (!/^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/.test(origin)) {
  throw new Error('DEPLOY_PREVIEW_ORIGIN must be the Nothing But A Dice Roller Netlify PR preview origin.');
}

const desktop = { width: 1440, height: 900, mobile: false };
function previewPage(pathname = '/') {
  const url = new URL(pathname, `${origin}/`);
  url.searchParams.set('ntl-drawer-state', 'hidden');
  return url.href;
}
function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }
async function fetchTextWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.text();
      lastError = new Error(`Glow texture request returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await sleep(attempt * 400);
  }
  throw lastError || new Error('Glow texture request failed.');
}

async function run() {
  let browser;
  try {
    browser = await launchBrowser();
    const client = browser.client;
    await navigate(client, previewPage('/customize.html'), desktop);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice Studio ready.')", 15000);

    await client.evaluate("document.querySelector('#new-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('New set ready.')");
    await client.evaluate("document.querySelector('.studio-preview-die[data-die=\"d4\"]')?.click()");
    await waitFor(client, "document.querySelector('#selected-die-label')?.textContent === 'D4' && document.querySelector('#logical-face')?.value === '4'");

    await client.evaluate(`(() => {
      const separate = document.querySelector('#die-style-enabled');
      separate.checked = true;
      separate.dispatchEvent(new Event('change', { bubbles: true }));
      const color = document.querySelector('#die-glow-color');
      color.value = '#00ffcc';
      color.dispatchEvent(new Event('input', { bubbles: true }));
      const glow = document.querySelector('#die-glow-enabled');
      glow.checked = true;
      glow.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('D4 number glow enabled')");

    const preview = await client.evaluate(`(() => ({
      face: document.querySelector('#logical-face-label')?.textContent || '',
      result: document.querySelector('#logical-result-label')?.textContent || '',
      text: document.querySelector('.studio-preview-die[data-die="d4"] span')?.textContent || '',
      shadow: document.querySelector('.studio-preview-die[data-die="d4"] span')?.style.textShadow || '',
      mapShadow: document.querySelector('#face-map [data-face="4"] [data-face-glyph]')?.style.textShadow || '',
      mapGlow: document.querySelector('#face-map [data-face="4"] [data-face-glyph]')?.dataset.numberGlow || '',
      glowChecked: Boolean(document.querySelector('#die-glow-enabled')?.checked),
      glowColor: document.querySelector('#die-glow-color')?.value || '',
    }))()`);
    assert.match(preview.face, /Face 4/);
    assert.match(preview.result, /Always reports 4/);
    assert.equal(preview.text, '4');
    assert.equal(preview.glowChecked, true);
    assert.equal(preview.glowColor.toLowerCase(), '#00ffcc');
    assert.ok(preview.shadow && preview.shadow !== 'none', 'Live d4 face 4 must visibly glow in the Studio model preview.');
    assert.equal(preview.mapGlow, 'active', 'Live d4 face map must identify enabled number glow.');
    assert.ok(preview.mapShadow && preview.mapShadow !== 'none', 'Live d4 face map must visibly render number glow too.');

    await client.evaluate("document.querySelector('#save-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Dice set saved.')");
    await client.evaluate("document.querySelector('#use-set')?.click()");
    await waitFor(client, "document.querySelector('#studio-status')?.textContent.includes('Set marked active for the roller.')");
    await client.evaluate("document.querySelector('.studio-header a[href=\"/\"]')?.click()");
    await waitFor(client, "location.pathname === '/' && document.querySelector('#physics-status')?.textContent.includes('3D physics ready.')", 30000);

    await client.evaluate("document.querySelector('.die-btn[data-type=\"d4\"]')?.click()");
    await waitFor(client, "document.querySelector('#pool-summary')?.textContent.includes('d4')");
    await client.evaluate("document.querySelector('#roll-btn')?.click()");
    await waitFor(client, "Number(document.querySelector('#total-result')?.textContent) >= 1 && !document.querySelector('#roll-btn')?.disabled", 30000);

    const roll = await client.evaluate(`(() => ({
      total: Number(document.querySelector('#total-result')?.textContent),
      breakdown: document.querySelector('#breakdown-text')?.textContent || '',
      diffuse: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((url) => url.includes('/api/dice-theme/') && url.endsWith('/diffuse.svg')),
    }))()`);
    assert.ok(roll.total >= 1 && roll.total <= 4, `Live glowing d4 must remain mechanically 1-4; received ${roll.total}.`);
    assert.match(roll.breakdown, /d4/i);
    assert.ok(roll.diffuse.length >= 1, 'Live glowing d4 must request a generated diffuse texture.');

    let generatedGlowUrl = '';
    for (const url of roll.diffuse) {
      const svg = await fetchTextWithRetry(url);
      if (svg.includes('id="numberGlow"') && svg.toLowerCase().includes('#00ffcc') && svg.includes('data-number-glow="halo"')) {
        generatedGlowUrl = url;
        break;
      }
    }
    assert.ok(generatedGlowUrl, 'Live generated d4 texture must contain the selected #00ffcc baked number halo.');

    const raster = await client.evaluate(`(async () => {
      const response = await fetch(${JSON.stringify(generatedGlowUrl)}, { cache: 'no-store' });
      const svg = await response.text();
      const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        image.src = objectUrl;
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Glow SVG did not rasterize.')); });
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let cyanPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2], a = pixels[index + 3];
          if (a > 25 && r < 90 && g > 145 && b > 120) cyanPixels += 1;
        }
        return { width: canvas.width, height: canvas.height, cyanPixels };
      } finally { URL.revokeObjectURL(objectUrl); }
    })()`);
    assert.equal(raster.width, 1024); assert.equal(raster.height, 1024);
    assert.ok(raster.cyanPixels > 100, `Rendered glow texture must contain a visible cyan halo; received ${raster.cyanPixels} cyan pixels.`);

    console.log(`Live d4 number-glow acceptance passed: model + face-map glow are visible, generated texture rasterized ${raster.cyanPixels} cyan halo pixels, Save/Use works, and physical d4 remains 1-4.`);
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('D4 glow browser cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Live d4 number-glow acceptance failed:', error);
  process.exitCode = 1;
});
