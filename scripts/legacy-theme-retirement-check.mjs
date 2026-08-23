import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

try {
  const [app, legacyClient, saveTheme, themesApi, releaseStrip, privacyDelete, privacyExport] = await Promise.all([
    read('js/app.js'),
    read('js/theme-community.js'),
    read('netlify/functions/save-theme.mjs'),
    read('netlify/functions/themes.mjs'),
    read('scripts/release-strip.mjs'),
    read('netlify/functions/account-data-delete.mjs'),
    read('netlify/functions/account-data-export.mjs'),
  ]);

  assert.equal(app.includes('theme-community'), false, 'Production app must not bootstrap the retired Theme Studio client.');
  assert.ok(legacyClient.includes("accountFetch('/api/save-theme'"), 'Legacy source fixture should still prove what was retired.');
  assert.ok(saveTheme.includes("code: 'legacy-theme-retired'"), 'Legacy theme writes must stay permanently retired.');
  assert.ok(saveTheme.includes('410'), 'Legacy theme writer must return HTTP 410 Gone.');
  assert.equal(/request\.method\s*===\s*['"]POST['"]/.test(themesApi), false, 'Legacy themes compatibility API must not accept writes.');
  assert.ok(themesApi.includes("request.method === 'GET'"), 'Legacy themes must remain readable for migration/cleanup.');
  assert.ok(themesApi.includes("request.method === 'DELETE'"), 'Legacy themes must remain deletable for privacy cleanup.');
  assert.ok(releaseStrip.includes("'js/theme-community.js'"), 'Retired Theme Studio client must be stripped from production releases.');
  assert.ok(privacyDelete.includes('legacy'), 'Account-data deletion must retain legacy cleanup coverage.');
  assert.ok(privacyExport.includes('legacy'), 'Account-data export must retain legacy migration coverage.');

  console.log('Legacy Theme Studio retirement passed: dead client is not bootstrapped or shipped, writes are 410 Gone, and historical data remains readable/deletable/exportable for compatibility and privacy cleanup.');
} catch (error) {
  console.error('Legacy Theme Studio retirement failed:', error);
  process.exitCode = 1;
}
