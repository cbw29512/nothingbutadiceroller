import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const origin = 'https://nothingbutattrpgdiceroller.netlify.app';

const indexablePages = Object.freeze([
  ['index.html', `${origin}/`],
  ['resources.html', `${origin}/resources.html`],
  ['d20-roller.html', `${origin}/d20-roller.html`],
  ['advantage-disadvantage.html', `${origin}/advantage-disadvantage.html`],
  ['dice-probability.html', `${origin}/dice-probability.html`],
  ['3d-dice-roller.html', `${origin}/3d-dice-roller.html`],
  ['ttrpg-dice-roller.html', `${origin}/ttrpg-dice-roller.html`],
  ['custom-dice-roller.html', `${origin}/custom-dice-roller.html`],
  ['d100-roller.html', `${origin}/d100-roller.html`],
  ['dice-notation.html', `${origin}/dice-notation.html`],
  ['dice-randomness.html', `${origin}/dice-randomness.html`],
  ['custom-3d-dice.html', `${origin}/custom-3d-dice.html`],
  ['how-to.html', `${origin}/how-to.html`],
  ['privacy.html', `${origin}/privacy.html`],
  ['legal.html', `${origin}/legal.html`],
]);

function oneMatch(source, regex, label) {
  const matches = [...source.matchAll(regex)];
  assert.equal(matches.length, 1, `${label} must appear exactly once.`);
  return matches[0][1];
}

function decodeBasicEntities(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
}

async function validateIndexablePage(path, canonical) {
  const html = await readFile(resolve(root, path), 'utf8');
  const title = decodeBasicEntities(oneMatch(html, /<title>([^<]+)<\/title>/gi, `${path} title`)).trim();
  const description = oneMatch(html, /<meta\s+name="description"\s+content="([^"]+)"/gi, `${path} meta description`).trim();
  const robots = oneMatch(html, /<meta\s+name="robots"\s+content="([^"]+)"/gi, `${path} robots`).toLowerCase();
  const actualCanonical = oneMatch(html, /<link\s+rel="canonical"\s+href="([^"]+)"/gi, `${path} canonical`);
  assert.ok(title.length >= 20 && title.length <= 70, `${path} title should be useful and concise; got ${title.length} chars.`);
  assert.ok(description.length >= 70 && description.length <= 180, `${path} description should be useful and concise; got ${description.length} chars.`);
  assert.match(robots, /index/);
  assert.match(robots, /follow/);
  assert.equal(actualCanonical, canonical, `${path} canonical mismatch.`);
  assert.match(html, /<h1>[^<]+<\/h1>/i, `${path} needs one visible primary heading.`);
  if (path !== 'index.html') assert.match(html, /href="\/"/, `${path} must link back to the roller.`);

  const ldJsonBlocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  assert.ok(ldJsonBlocks.length >= 1, `${path} must include structured data.`);
  for (const block of ldJsonBlocks) assert.doesNotThrow(() => JSON.parse(block[1]), `${path} structured data must be valid JSON.`);

  return { title, canonical };
}

try {
  const metadata = [];
  for (const [path, canonical] of indexablePages) metadata.push(await validateIndexablePage(path, canonical));
  assert.equal(new Set(metadata.map(({ title }) => title)).size, metadata.length, 'Indexable page titles must be unique.');
  assert.equal(new Set(metadata.map(({ canonical }) => canonical)).size, metadata.length, 'Canonical URLs must be unique.');

  const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'Sitemap URLs must not be duplicated.');
  for (const [, canonical] of indexablePages) assert.ok(sitemapUrls.includes(canonical), `Sitemap is missing ${canonical}.`);

  const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Allow:\s*\//i);
  assert.ok(robots.includes(`${origin}/sitemap.xml`), 'robots.txt must advertise the canonical sitemap.');

  for (const privatePath of ['customize.html', 'rolls.html', 'moderation.html', 'appearance-harness.html', 'shortcut-harness.html']) {
    const html = await readFile(resolve(root, privatePath), 'utf8');
    assert.match(html, /name="robots" content="noindex,nofollow"/i, `${privatePath} must remain excluded from search indexing.`);
  }

  const resources = await readFile(resolve(root, 'resources.html'), 'utf8');
  for (const href of ['/d20-roller.html', '/advantage-disadvantage.html', '/dice-probability.html', '/3d-dice-roller.html', '/ttrpg-dice-roller.html', '/custom-dice-roller.html', '/d100-roller.html', '/dice-notation.html', '/dice-randomness.html', '/custom-3d-dice.html']) {
    assert.ok(resources.includes(`href="${href}"`), `Resource hub must link to ${href}.`);
  }

  const manifest = JSON.parse(await readFile(resolve(root, 'site.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.shortcuts?.some(({ url }) => url === '/dice-probability.html'), 'PWA must expose the d20 odds shortcut.');
  assert.ok(manifest.shortcuts?.some(({ url }) => url === '/resources.html'), 'PWA must expose the resource hub shortcut.');

  const { d20ThresholdProbability } = await import(pathToFileURL(resolve(root, 'js/dice-probability.js')).href);
  const example = d20ThresholdProbability(15, 5);
  assert.equal(example.successfulFaces, 11);
  assert.equal(example.normal, 0.55);
  assert.ok(Math.abs(example.advantage - 0.7975) < Number.EPSILON * 4);
  assert.ok(Math.abs(example.disadvantage - 0.3025) < Number.EPSILON * 4);
  assert.equal(d20ThresholdProbability(1, 100).normal, 1);
  assert.equal(d20ThresholdProbability(200, -100).normal, 0);
  assert.throws(() => d20ThresholdProbability(Number.NaN, 0), /finite numbers/);

  console.log(`SEO/growth contract passed: ${indexablePages.length} indexable pages, unique canonicals/titles, complete sitemap, protected noindex tools, PWA shortcuts, and exact d20 odds.`);
} catch (error) {
  console.error('SEO/growth contract failed:', error);
  process.exitCode = 1;
}
