import assert from 'node:assert/strict';
import { assertReleaseSizeBudget, evaluateReleaseSizeBudget, RELEASE_SIZE_BUDGETS } from './release-size-budget.mjs';

const KIB = 1024;
const baseline = Object.freeze({
  files: 180,
  totalGzip: 1407 * KIB,
  appearanceGzip: 111 * KIB,
  assetGzip: Object.freeze({
    'js/app.js': 69 * KIB,
    'js/appearance/studio.js': 34 * KIB,
    'js/rolls.js': 26 * KIB,
    'social-card.png': 100 * KIB,
  }),
});

try {
  assert.equal(evaluateReleaseSizeBudget(baseline).ok, true);
  assert.doesNotThrow(() => assertReleaseSizeBudget(baseline));

  const boundary = {
    files: RELEASE_SIZE_BUDGETS.maxFiles,
    totalGzip: RELEASE_SIZE_BUDGETS.maxTotalGzip,
    appearanceGzip: RELEASE_SIZE_BUDGETS.maxAppearanceGzip,
    assetGzip: { ...RELEASE_SIZE_BUDGETS.assetGzip },
  };
  assert.equal(evaluateReleaseSizeBudget(boundary).ok, true, 'Exact budget boundaries must pass.');

  assert.throws(
    () => assertReleaseSizeBudget({ ...baseline, totalGzip: RELEASE_SIZE_BUDGETS.maxTotalGzip + 1 }),
    /Total release gzip size/,
  );
  assert.throws(
    () => assertReleaseSizeBudget({ ...baseline, assetGzip: { ...baseline.assetGzip, 'js/app.js': 91 * KIB } }),
    /js\/app\.js gzip size/,
  );
  const missingAsset = { ...baseline, assetGzip: { ...baseline.assetGzip } };
  delete missingAsset.assetGzip['social-card.png'];
  assert.throws(() => assertReleaseSizeBudget(missingAsset), /measurement is missing: social-card\.png/);

  console.log('Release size budget checks passed: baseline/boundary fit, total and app regressions fail closed, and tracked assets cannot disappear from measurement.');
} catch (error) {
  console.error('Release size budget checks failed:', error);
  process.exitCode = 1;
}
