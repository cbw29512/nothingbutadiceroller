import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const policyScript = fileURLToPath(new URL('./netlify-production-only.mjs', import.meta.url));

function runPolicy(overrides) {
  const env = {
    ...process.env,
    CONTEXT: '',
    BRANCH: '',
    HEAD: '',
    PULL_REQUEST: '',
    ...overrides,
  };
  const result = spawnSync(process.execPath, [policyScript], {
    env,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return result;
}

try {
  const cases = [
    {
      name: 'production main builds',
      env: { CONTEXT: 'production', BRANCH: 'main' },
      expectedStatus: 1,
      message: 'Allowing Netlify build',
    },
    {
      name: 'production develop skips',
      env: { CONTEXT: 'production', BRANCH: 'develop' },
      expectedStatus: 0,
      message: 'Skipping Netlify build',
    },
    {
      name: 'explicit preview PR builds',
      env: {
        CONTEXT: 'deploy-preview',
        BRANCH: 'preview/growth-cert-20260827',
        HEAD: 'preview/growth-cert-20260827',
        PULL_REQUEST: 'true',
      },
      expectedStatus: 1,
      message: 'Allowing Netlify build',
    },
    {
      name: 'ordinary feature PR skips',
      env: {
        CONTEXT: 'deploy-preview',
        BRANCH: 'growth/free-seo-polish-20260824',
        HEAD: 'growth/free-seo-polish-20260824',
        PULL_REQUEST: 'true',
      },
      expectedStatus: 0,
      message: 'Skipping Netlify build',
    },
    {
      name: 'preview branch without PR skips',
      env: {
        CONTEXT: 'deploy-preview',
        BRANCH: 'preview/manual',
        HEAD: 'preview/manual',
        PULL_REQUEST: 'false',
      },
      expectedStatus: 0,
      message: 'Skipping Netlify build',
    },
    {
      name: 'preview-named branch deploy skips',
      env: {
        CONTEXT: 'branch-deploy',
        BRANCH: 'preview/manual',
        HEAD: 'preview/manual',
        PULL_REQUEST: 'false',
      },
      expectedStatus: 0,
      message: 'Skipping Netlify build',
    },
    {
      name: 'deploy preview can fall back to BRANCH',
      env: {
        CONTEXT: 'deploy-preview',
        BRANCH: 'preview/fallback-cert',
        PULL_REQUEST: 'true',
      },
      expectedStatus: 1,
      message: 'Allowing Netlify build',
    },
    {
      name: 'missing metadata fails closed',
      env: {},
      expectedStatus: 0,
      message: 'Skipping Netlify build',
    },
  ];

  for (const testCase of cases) {
    const result = runPolicy(testCase.env);
    assert.equal(
      result.status,
      testCase.expectedStatus,
      `${testCase.name}: expected exit ${testCase.expectedStatus}, stderr=${result.stderr}`,
    );
    assert.match(result.stdout, new RegExp(testCase.message), `${testCase.name}: unexpected policy output`);
  }

  console.log('Netlify build policy contract passed: only production main and explicit preview/* pull-request certification builds are allowed.');
} catch (error) {
  console.error('Netlify build policy contract failed:', error);
  process.exitCode = 1;
}
