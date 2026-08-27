import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

try {
  const [workflow, acceptance, liveGrowth, liveSurface, livePattern, liveInlay, pkgSource] = await Promise.all([
    read('.github/workflows/deploy-preview-acceptance.yml'),
    read('scripts/deploy-preview-acceptance.mjs'),
    read('scripts/deploy-preview-growth-smoke.mjs'),
    read('scripts/deploy-preview-surface-finish.mjs'),
    read('scripts/deploy-preview-surface-pattern.mjs'),
    read('scripts/deploy-preview-edge-inlay.mjs'),
    read('package.json'),
  ]);
  const pkg = JSON.parse(pkgSource);

  for (const marker of [
    'github.event.pull_request.head.sha',
    'netlify/nothingbutattrpgdiceroller/deploy-preview',
    'Wait for Netlify success on this exact head',
    'Live Deploy Preview Acceptance',
    'node scripts/deploy-preview-acceptance.mjs',
    'node scripts/deploy-preview-growth-smoke.mjs',
    'node scripts/deploy-preview-surface-finish.mjs',
    'node scripts/deploy-preview-surface-pattern.mjs',
    'node scripts/deploy-preview-edge-inlay.mjs',
    'actions/upload-artifact@v7',
    'statuses: read',
    'cancel-in-progress: true',
  ]) assert.ok(workflow.includes(marker), `Deploy Preview workflow is missing: ${marker}`);

  for (const marker of [
    'DEPLOY_PREVIEW_ORIGIN', 'assertDesktopRollInteraction', 'assertMobileCustomInteraction',
    'retryableStatuses', 'fetchWithRetry', 'navigateWithRetry',
    "localStorage.clear()", "localStorage.getItem('keepDice')", "localStorage.getItem('soundEnabled')", "localStorage.getItem('rollHistory')",
    '/api/dice-sets?scope=community&page=1&pageSize=1', '/api/account-data',
    '/vendor/dice-box-1.1.4/dice-box.es.min.js', '/js/appearance/studio.js', 'Page.captureScreenshot',
  ]) assert.ok(acceptance.includes(marker), `Deploy Preview acceptance is missing: ${marker}`);

  for (const marker of [
    'DEPLOY_PREVIEW_ORIGIN', '/resources.html', '/dice-probability.html', '/custom-3d-dice.html',
    'productionOrigin', 'rel="canonical"', 'index,follow,max-image-preview:large',
    '/js/dice-probability.js', '/sitemap.xml', '/robots.txt', 'id="discover-title"',
  ]) assert.ok(liveGrowth.includes(marker), `Live growth acceptance is missing: ${marker}`);

  for (const marker of [
    'DEPLOY_PREVIEW_ORIGIN', "'#surface-finish'", "'metallic'", "'pearl'", 'surfaceMetallic',
    "data-die=\"d20\"", "data-die=\"d6\"", 'total >= 1 && roll.total <= 20', 'selectHeight >= 40',
  ]) assert.ok(liveSurface.includes(marker), `Live surface-finish acceptance is missing: ${marker}`);

  for (const marker of [
    'DEPLOY_PREVIEW_ORIGIN', "'#surface-pattern'", "'marble'", "'speckle'", 'patternMarble',
    "data-die=\"d20\"", "data-die=\"d6\"", 'roll.total >= 1 && roll.total <= 20', 'selectHeight >= 40',
  ]) assert.ok(livePattern.includes(marker), `Live surface-pattern acceptance is missing: ${marker}`);

  for (const marker of [
    'DEPLOY_PREVIEW_ORIGIN', "'#edge-inlay'", "'bold'", "'dotted'", 'edgeInlay',
    "data-die=\"d20\"", "data-die=\"d6\"", 'roll.total >= 1 && roll.total <= 20', 'selectHeight >= 40',
  ]) assert.ok(liveInlay.includes(marker), `Live edge-inlay acceptance is missing: ${marker}`);

  assert.equal(pkg.scripts?.['test:preview'], 'node scripts/deploy-preview-acceptance.mjs');
  assert.ok(pkg.scripts?.check?.includes('node scripts/deploy-preview-acceptance-contract.mjs'));
  assert.ok(pkg.scripts?.check?.includes('node scripts/edge-inlay-check.mjs'));
  assert.ok(pkg.scripts?.['test:browser']?.includes('node scripts/browser-edge-inlay.mjs'));

  console.log('Deploy Preview acceptance contract passed: exact-head Netlify synchronization, transient request/navigation retry protection, live public growth pages, hosted browser checks including surface finishes/patterns/UV edge inlays, guest persistence, and screenshot evidence are release-enforced.');
} catch (error) {
  console.error('Deploy Preview acceptance contract failed:', error);
  process.exitCode = 1;
}
