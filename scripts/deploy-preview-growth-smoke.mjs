import assert from 'node:assert/strict';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').replace(/\/$/, '');
const headSha = String(process.env.HEAD_SHA || '');
assert.match(origin, /^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/, 'DEPLOY_PREVIEW_ORIGIN must be the expected Netlify PR preview.');
assert.match(headSha, /^[0-9a-f]{40}$/i, 'HEAD_SHA must identify the exact PR head.');

const productionOrigin = 'https://nothingbutattrpgdiceroller.netlify.app';
const pages = Object.freeze([
  '/',
  '/resources.html',
  '/d20-roller.html',
  '/advantage-disadvantage.html',
  '/dice-probability.html',
  '/3d-dice-roller.html',
  '/ttrpg-dice-roller.html',
  '/custom-dice-roller.html',
  '/d100-roller.html',
  '/dice-notation.html',
  '/dice-randomness.html',
  '/custom-3d-dice.html',
]);

function canonicalFor(path) {
  return path === '/' ? `${productionOrigin}/` : `${productionOrigin}${path}`;
}

function requestUrl(path, attempt = 0) {
  const url = new URL(path, `${origin}/`);
  url.searchParams.set('release_sha', headSha);
  if (attempt) url.searchParams.set('edge_attempt', String(attempt));
  return url;
}

async function fetchText(path, attempt = 0) {
  const response = await fetch(requestUrl(path, attempt), {
    redirect: 'follow',
    headers: { 'cache-control': 'no-cache, no-store', pragma: 'no-cache' },
  });
  assert.equal(response.ok, true, `${path} must return a successful response; got ${response.status}.`);
  return { response, text: await response.text() };
}

async function fetchUntil(path, predicate, label, attempts = 20) {
  let latest = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = await fetchText(path, attempt);
    if (predicate(latest.text)) return latest;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`${label} did not appear after ${attempts} cache-busted attempts on the exact Deploy Preview.`);
}

try {
  for (const path of pages) {
    const { response, text } = await fetchText(path);
    assert.match(response.headers.get('content-type') || '', /text\/html/i, `${path} must be served as HTML.`);
    assert.match(text, /<title>[^<]+<\/title>/i, `${path} must ship a title.`);
    assert.match(text, /<h1>[^<]+<\/h1>/i, `${path} must ship a visible h1.`);
    assert.ok(text.includes(`rel="canonical" href="${canonicalFor(path)}"`), `${path} must canonicalize to production, not the preview origin.`);
    assert.match(text, /name="robots" content="index,follow,max-image-preview:large"/i, `${path} must remain indexable after deployment.`);
  }

  const { text: home } = await fetchUntil(
    '/',
    (text) => text.includes('id="discover-title"') && text.includes('href="/resources.html"') && text.includes('href="/dice-probability.html"'),
    'Final homepage discovery layer',
  );
  assert.ok(home.includes('id="discover-title"'), 'Live homepage must include the below-app discovery layer.');
  assert.ok(home.includes('href="/resources.html"'), 'Live homepage must link to the resource hub.');
  assert.ok(home.includes('href="/dice-probability.html"'), 'Live homepage must link to the d20 odds tool.');

  const { response: probabilityJsResponse, text: probabilityJs } = await fetchUntil(
    '/js/dice-probability.js',
    (text) => text.includes('d20ThresholdProbability'),
    'Final d20 probability module',
  );
  assert.match(probabilityJsResponse.headers.get('content-type') || '', /(javascript|text\/plain)/i, 'Probability module must be served as JavaScript.');

  const { response: sitemapResponse, text: sitemap } = await fetchUntil(
    '/sitemap.xml',
    (text) => pages.every((path) => text.includes(`<loc>${canonicalFor(path)}</loc>`)),
    'Final expanded sitemap',
  );
  assert.match(sitemapResponse.headers.get('content-type') || '', /(xml|text\/plain)/i, 'Sitemap must be served as XML/text.');

  const { text: robots } = await fetchUntil(
    '/robots.txt',
    (text) => text.includes(`Sitemap: ${productionOrigin}/sitemap.xml`),
    'Final robots sitemap declaration',
  );
  assert.ok(robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`), 'Live robots.txt must advertise the production sitemap.');

  console.log(`Live growth smoke passed: ${pages.length} public pages, production canonicals, cache-propagated homepage discovery links, probability module, sitemap, and robots.txt are reachable on exact head ${headSha}.`);
} catch (error) {
  console.error('Live growth smoke failed:', error);
  process.exitCode = 1;
}
