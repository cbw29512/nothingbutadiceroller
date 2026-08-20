import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const [accountApi, authUi, buildScript] = await Promise.all([
  readFile(resolve(root, 'js/account-api.js'), 'utf8'),
  readFile(resolve(root, 'js/auth-ui.js'), 'utf8'),
  readFile(resolve(root, 'scripts/build.mjs'), 'utf8'),
]);

for (const reference of [
  "from '@netlify/identity'",
  'handleAuthCallback',
  'processIdentityCallback',
  'onAuthChange',
  'loginAccount',
  'signupAccount',
  'logoutAccount',
]) {
  assert.ok(accountApi.includes(reference), `Browser Identity contract is missing: ${reference}`);
}

assert.ok(
  authUi.includes('processIdentityCallback'),
  'Auth UI must process Netlify Identity callback hashes in the browser.',
);
assert.ok(
  authUi.includes('const callbackHandled = await processCallback(onSession)'),
  'Auth callback must run before the ordinary session refresh.',
);
assert.ok(
  !authUi.includes("authAction('confirm'"),
  'Email confirmation must not fall back to the legacy server-side manual confirm action.',
);

assert.ok(buildScript.includes("from 'esbuild'"), 'Browser Identity client must be bundled for production.');
assert.ok(buildScript.includes('bundle: true'), 'Browser application bundling must remain enabled.');
assert.ok(buildScript.includes("platform: 'browser'"), 'Identity bundle must target the browser.');

console.log('Auth contract passed: browser callback handling, browser session flow, and bundling are protected.');
