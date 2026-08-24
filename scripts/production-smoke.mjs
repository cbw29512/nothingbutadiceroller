const origin = new URL(process.env.SITE_ORIGIN || 'https://nothingbutattrpgdiceroller.netlify.app').origin;
const timeoutMs = 20_000;

async function get(path, { accept = '*/*' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, origin), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: accept,
        'User-Agent': 'nothingbutadiceroller-production-smoke/1.0',
      },
    });
    return { response, ms: Math.round(performance.now() - started) };
  } finally {
    clearTimeout(timer);
  }
}

function requireStatus(result, expected, label) {
  if (result.response.status !== expected) {
    throw new Error(`${label} returned HTTP ${result.response.status}; expected ${expected}.`);
  }
  console.log(`✓ ${label}: ${result.response.status} in ${result.ms} ms`);
}

try {
  const home = await get('/', { accept: 'text/html' });
  requireStatus(home, 200, 'roller homepage');
  const homeText = await home.response.text();
  if (!homeText.includes('Nothing But A Dice Roller') || !homeText.includes('SECURE RANDOMIZATION ENGINE')) {
    throw new Error('Roller homepage is missing expected production markers.');
  }
  const csp = home.response.headers.get('content-security-policy') || '';
  for (const directive of ["default-src 'self'", "frame-ancestors 'self' https://app.netlify.com"]) {
    if (!csp.includes(directive)) throw new Error(`Production CSP is missing: ${directive}`);
  }

  const runtime = await get('/vendor/dice-box-1.1.4/dice-box.es.min.js', { accept: 'text/javascript,*/*' });
  requireStatus(runtime, 200, 'self-hosted DiceBox runtime');
  if (!/javascript|ecmascript/.test(runtime.response.headers.get('content-type') || '')) {
    throw new Error('DiceBox runtime is not served with a JavaScript content type.');
  }

  const manifest = await get('/site.webmanifest', { accept: 'application/manifest+json,application/json' });
  requireStatus(manifest, 200, 'web app manifest');
  const manifestJson = await manifest.response.json();
  if (manifestJson?.name !== 'Nothing But A Dice Roller' || manifestJson?.start_url !== '/') {
    throw new Error('Production manifest does not contain the expected app identity.');
  }

  const community = await get('/api/dice-sets?scope=community&page=1&pageSize=1', { accept: 'application/json' });
  requireStatus(community, 200, 'Community Blob/API health');
  const communityJson = await community.response.json();
  if (!Array.isArray(communityJson?.records) || communityJson?.page !== 1 || communityJson?.pageSize !== 1) {
    throw new Error('Community API returned an unexpected payload shape.');
  }

  const accountBoundary = await get('/api/account-data', { accept: 'application/json' });
  requireStatus(accountBoundary, 401, 'account authentication boundary');
  const accountJson = await accountBoundary.response.json();
  if (accountJson?.code !== 'authentication-required') {
    throw new Error('Account-data endpoint did not preserve the expected unauthenticated boundary.');
  }

  console.log(`Production synthetic passed for ${origin}.`);
} catch (error) {
  console.error(`Production synthetic failed for ${origin}:`, error);
  process.exitCode = 1;
}
