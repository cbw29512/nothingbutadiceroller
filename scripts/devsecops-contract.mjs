import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

const [ignore, security, dependabot, codeql, lock] = await Promise.all([
  read('.gitignore'), read('SECURITY.md'), read('.github/dependabot.yml'),
  read('.github/workflows/codeql.yml'), read('package-lock.json'),
]);

assert.match(ignore, /^node_modules\/$/m, 'node_modules must remain ignored.');
const trackedNodeModules = execFileSync('git', ['ls-files', 'node_modules'], { encoding: 'utf8' }).trim();
assert.equal(trackedNodeModules, '', 'node_modules must not be tracked in Git.');
assert.ok(JSON.parse(lock).lockfileVersion >= 3, 'A modern package-lock.json must remain tracked.');

for (const text of [
  '# Security Policy', 'Report a vulnerability', 'Do not post exploit details',
  'Never commit secrets', 'rotate/revoke',
]) assert.ok(security.includes(text), `SECURITY.md is missing: ${text}`);

for (const text of [
  'version: 2', 'package-ecosystem: npm', 'package-ecosystem: github-actions',
  'interval: weekly', 'open-pull-requests-limit: 5',
]) assert.ok(dependabot.includes(text), `Dependabot policy is missing: ${text}`);

for (const text of [
  'name: CodeQL Security Analysis', 'security-events: write', 'contents: read',
  'uses: github/codeql-action/init@v4', 'languages: javascript-typescript',
  'queries: security-extended', 'uses: github/codeql-action/analyze@v4',
]) assert.ok(codeql.includes(text), `CodeQL workflow is missing: ${text}`);

assert.ok(!codeql.includes('pull_request_target:'), 'CodeQL must not use pull_request_target.');
assert.ok(!codeql.includes('contents: write'), 'CodeQL must not request content write permission.');

console.log('DevSecOps contract passed: node_modules is untracked, lockfile retained, private-reporting guidance exists, Dependabot covers npm/Actions, and CodeQL is read-only except security-event upload.');
