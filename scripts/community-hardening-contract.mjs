import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

try {
  const [libraryApi, saveApi, storeLayer, studioCloud, studio, bindings, html] = await Promise.all([
    read('netlify/functions/dice-sets.mjs'),
    read('netlify/functions/save-dice-set.mjs'),
    read('netlify/functions/dice-set-store.mjs'),
    read('js/appearance/studio-cloud.mjs'),
    read('js/appearance/studio.js'),
    read('js/appearance/studio-bindings.mjs'),
    read('customize.html'),
  ]);

  [
    'DEFAULT_COMMUNITY_PAGE_SIZE = 24',
    'MAX_COMMUNITY_PAGE_SIZE = 48',
    'MAX_COMMUNITY_PAGE = 20',
    'hasMore: ordered.length > end',
    'windowLimit: 120',
    "aggregateBy: ['ip', 'domain']",
  ].forEach((text) => requireText(libraryApi, text, 'Community API limit'));

  [
    'windowLimit: 30',
    'windowSize: 60',
    "aggregateBy: ['ip', 'domain']",
  ].forEach((text) => requireText(saveApi, text, 'save/upload rate limit'));

  [
    'MAX_COMMUNITY_CURRENT_CANDIDATES = 1000',
    'MAX_COMMUNITY_LEGACY_CANDIDATES = 250',
    'paginate: true',
    '{ bounded: true, maxKeys: maxCandidates }',
    'if (scanned >= maxCandidates) break',
  ].forEach((text) => requireText(storeLayer, text, 'bounded Blob listing'));

  [
    'loadCommunityDiceSetPage',
    "scope: 'community'",
    'page: String(page)',
    'pageSize: String(pageSize)',
    'hasMore: data.hasMore === true',
  ].forEach((text) => requireText(studioCloud, text, 'Community page client'));

  [
    'COMMUNITY_PAGE_SIZE = 24',
    'applyCommunityPage',
    'loadMoreCommunity',
    'communityPage + 1',
    "loadMore.textContent = communityLoading ? 'Loading Community…' : 'Load More Community Sets'",
  ].forEach((text) => requireText(studio, text, 'Community paging UI state'));

  requireText(bindings, "q('load-more-community').addEventListener('click', actions.loadMoreCommunity)", 'Community load-more binding');
  requireText(html, 'id="load-more-community"', 'Community load-more button');

  console.log('Community hardening contract passed: bounded Blob reads, explicit page limits, browser load-more flow, and Netlify function rate limits are present.');
} catch (error) {
  console.error('Community hardening contract failed:', error);
  process.exitCode = 1;
}
