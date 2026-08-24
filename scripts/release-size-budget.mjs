const KIB = 1024;

export const RELEASE_SIZE_BUDGETS = Object.freeze({
  maxFiles: 225,
  maxTotalGzip: 1800 * KIB,
  maxAppearanceGzip: 150 * KIB,
  assetGzip: Object.freeze({
    'js/app.js': 90 * KIB,
    'js/appearance/studio.js': 50 * KIB,
    'js/rolls.js': 40 * KIB,
    'social-card.png': 130 * KIB,
  }),
});

function kib(bytes) {
  return `${(bytes / KIB).toFixed(1)} KiB`;
}

function addLimitViolation(violations, label, actual, limit) {
  if (!Number.isFinite(actual) || actual < 0) {
    violations.push(`${label} measurement is invalid.`);
    return;
  }
  if (actual > limit) violations.push(`${label} is ${kib(actual)}; budget is ${kib(limit)}.`);
}

export function evaluateReleaseSizeBudget(metrics, budgets = RELEASE_SIZE_BUDGETS) {
  const violations = [];

  if (!Number.isInteger(metrics?.files) || metrics.files < 0) {
    violations.push('Release file-count measurement is invalid.');
  } else if (metrics.files > budgets.maxFiles) {
    violations.push(`Release contains ${metrics.files} files; budget is ${budgets.maxFiles}.`);
  }

  addLimitViolation(violations, 'Total release gzip size', metrics?.totalGzip, budgets.maxTotalGzip);
  addLimitViolation(violations, 'Dice Studio appearance gzip size', metrics?.appearanceGzip, budgets.maxAppearanceGzip);

  for (const [path, limit] of Object.entries(budgets.assetGzip)) {
    if (!Object.hasOwn(metrics?.assetGzip ?? {}, path)) {
      violations.push(`Required release asset measurement is missing: ${path}.`);
      continue;
    }
    addLimitViolation(violations, `${path} gzip size`, metrics.assetGzip[path], limit);
  }

  return Object.freeze({ ok: violations.length === 0, violations: Object.freeze(violations) });
}

export function assertReleaseSizeBudget(metrics, budgets = RELEASE_SIZE_BUDGETS) {
  const result = evaluateReleaseSizeBudget(metrics, budgets);
  if (!result.ok) throw new Error(`Release size budget exceeded:\n- ${result.violations.join('\n- ')}`);
  return result;
}
