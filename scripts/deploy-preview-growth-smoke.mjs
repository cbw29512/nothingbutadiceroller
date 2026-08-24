import assert from 'node:assert/strict';

const origin = String(process.env.DEPLOY_PREVIEW_ORIGIN || '').replace(/\/$/, '');
assert.match(origin, /^https:\/\/deploy-preview-\d+--nothingbutattrpgdiceroller\.netlify\.app$/, 'DEPLOY_PREVIEW_ORIGIN must be the expected Netlify PR preview.');

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

async function fetchText(path) {
  const response = await fetch(`${origin}${path}`, {
    redirect: 'follow',
    headers: { 'cache-control': 'no-cache' },
  });
  assert.equal(response.ok, true, `${path} must return a successful response; got ${response.status}.`);
  return { response, text: await response.text() };
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

  const { text: home } = await fetchText('/');
  assert.ok(home.includes('id="discover-title"'), 'Live homepage must include the below-app discovery layer.');
  assert.ok(home.includes('href="/resources.html"'), 'Live homepage must link to the resource hub.');
  assert.ok(home.includes('href="/dice-probability.html"'), 'Live homepage must link to the d20 odds tool.');

  const { response: probabilityJsResponse, text: probabilityJs } = await fetchText('/js/dice-probability.js');
  assert.match(probabilityJsResponse.headers.get('content-type') || '', /(javascript|text\/plain)/i, 'Probability module must be served as JavaScript.');
  assert.ok(probabilityJs.includes('d20ThresholdProbability'), 'Live probability module must contain the tested odds engine.');

  const { response: sitemapResponse, text: sitemap } = await fetchText('/sitemap.xml');
  assert.match(sitemapResponse.headers.get('content-type') || '', /(xml|text\/plain)/i, 'Sitemap must be served as XML/text.');
  for (const path of pages) assert.ok(sitemap.includes(`<loc>${canonicalFor(path)}</loc>`), `Live sitemap must contain ${canonicalFor(path)}.`);

  const { text: robots } = await fetchText('/robots.txt');
  assert.ok(robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`), 'Live robots.txt must advertise the production sitemap.');

  console.log(`Live growth smoke passed: ${pages.length} public pages, production canonicals, homepage discovery links, probability module, sitemap, and robots.txt are reachable on the exact Deploy Preview.`);
} catch (error) {
  console.error('Live growth smoke failed:', error);
  process.exitCode = 1;
}
