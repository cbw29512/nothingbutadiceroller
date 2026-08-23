import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

try {
  const [workflow, acceptance, liveSurface, pkgSource] = await Promise.all([
    read('.github/workflows/deploy-preview-acceptance.yml'),
    read('scripts/deploy-preview-acceptance.mjs'),
    read('scripts/deploy-preview-surface-finish.mjs'),
    read('package.json'),
  ]);
  const pkg = JSON.parse(pkgSource);

  for (const marker of [
    'github.event.pull_request.head.sha',
    'netlify/nothingbutattrpgdiceroller/deploy-preview',
    'Wait for Netlify success on this exact head',
    'Live Deploy Preview Acceptance',
    'node scripts/deploy-preview-acceptance.mjs',
    'node scripts/deploy-preview-surface-finish.mjs',
    'actions/upload-artifact@v4',
    'statuses: read',
    'cancel-in-progress: true',
  ]) assert.ok(workflow.includes(marker), `Deploy Preview workflow is missing: ${marker}`);

  for (const marker of [
    'DEPLOY_PREVIEW_ORIGIN',
    'assertDesktopRollInteraction',
    'assertMobileCustomInteraction',
    "localStorage.clear()",
    "localStorage.getItem('keepDice')",
    "localStorage.getItem('soundEnabled')",
    "localStorage.getItem('rollHistory')",
    '/api/dice-sets?scope=community&page=1&pageSize=1',
    '/api/account-data',
    '/vendor/dice-box-1.1.4/dice-box.es.min.js',
    '/js/appearance/studio.js',
    'Page.captureScreenshot',
  ]) assert.ok(acceptance.includes(marker), `Deploy Preview acceptance is missing: ${marker}`);

  for (const marker of [
    'DEPLOY_PREVIEW_ORIGIN',
    "'#surface-finish'",
    "'metallic'",
    "'pearl'",
    'surfaceMetallic',
    "data-die=\"d20\"",
    "data-die=\"d6\"",
    'total >= 1 && roll.total <= 20',
    'selectHeight >= 40',
  ]) assert.ok(liveSurface.includes(marker), `Live surface-finish acceptance is missing: ${marker}`);

  assert.equal(pkg.scripts?.['test:preview'], 'node scripts/deploy-preview-acceptance.mjs');
  assert.ok(pkg.scripts?.check?.includes('node scripts/deploy-preview-acceptance-contract.mjs'));

  console.log('Deploy Preview acceptance contract passed: exact-head Netlify synchronization, live hosted browser checks including surface finishes, guest persistence, and screenshot evidence are release-enforced.');
} catch (error) {
  console.error('Deploy Preview acceptance contract failed:', error);
  process.exitCode = 1;
}
