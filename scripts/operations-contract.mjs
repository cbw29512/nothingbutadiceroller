import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

try {
  const [workflow, smoke, operations, index, manifestText, sitemap, robots] = await Promise.all([
    read('.github/workflows/production-smoke.yml'),
    read('scripts/production-smoke.mjs'),
    read('OPERATIONS.md'),
    read('index.html'),
    read('site.webmanifest'),
    read('sitemap.xml'),
    read('robots.txt'),
  ]);

  for (const marker of [
    'branches:\n      - main',
    "cron: '17,47 * * * *'",
    'workflow_dispatch:',
    'contents: read',
    'timeout-minutes: 5',
    'node scripts/production-smoke.mjs',
  ]) assert.ok(workflow.includes(marker), `Production monitor workflow is missing: ${marker}`);

  for (const marker of [
    "'/vendor/dice-box-1.1.4/dice-box.es.min.js'",
    "'/api/dice-sets?scope=community&page=1&pageSize=1'",
    "'/api/account-data'",
    "default-src 'self'",
    "frame-ancestors 'self' https://app.netlify.com",
    "accountJson?.code !== 'authentication-required'",
  ]) assert.ok(smoke.includes(marker), `Production synthetic is missing health assertion: ${marker}`);

  for (const marker of [
    'A Netlify deploy rollback changes the served code/static deploy.',
    'It must not be treated as a Blob-data rollback.',
    'Do not run destructive bulk migrations against production Blob data',
    'GitHub `main` branch protection/rules',
    'Deploy-failure notifications',
    'Billing/spend controls',
  ]) assert.ok(operations.includes(marker), `Operations runbook is missing: ${marker}`);

  for (const marker of [
    'rel="icon" href="/favicon.svg"',
    'rel="manifest" href="/site.webmanifest"',
    'property="og:image" content="https://nothingbutattrpgdiceroller.netlify.app/social-card.svg"',
    'name="twitter:card" content="summary_large_image"',
  ]) assert.ok(index.includes(marker), `Production metadata is missing: ${marker}`);

  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, 'Nothing But A Dice Roller');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.icons?.[0]?.src, '/favicon.svg');
  assert.ok(sitemap.includes('https://nothingbutattrpgdiceroller.netlify.app/how-to.html'));
  assert.ok(robots.includes('Sitemap: https://nothingbutattrpgdiceroller.netlify.app/sitemap.xml'));

  console.log('Production operations contract passed: scheduled synthetic monitoring, rollback/data-safety runbook, external-control checklist, app metadata, manifest, sitemap, and robots policy are all release-enforced.');
} catch (error) {
  console.error('Production operations contract failed:', error);
  process.exitCode = 1;
}
