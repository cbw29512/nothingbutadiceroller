import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { apiErrorResponse, publicError } from '../netlify/functions/api-errors.mjs';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

const endpointPaths = [
  'netlify/functions/auth.mjs',
  'netlify/functions/community-moderation.mjs',
  'netlify/functions/community-report.mjs',
  'netlify/functions/configurations.mjs',
  'netlify/functions/dice-set-image.mjs',
  'netlify/functions/dice-sets.mjs',
  'netlify/functions/dice-theme-assets.mjs',
  'netlify/functions/me.mjs',
  'netlify/functions/save-dice-set.mjs',
  'netlify/functions/save-theme.mjs',
  'netlify/functions/shortcuts.mjs',
  'netlify/functions/theme-image.mjs',
  'netlify/functions/themes.mjs',
];
const sources = Object.fromEntries(await Promise.all(endpointPaths.map(async (path) => [path, await read(path)])));

for (const [path, source] of Object.entries(sources)) {
  assert.ok(source.includes('export const config'), `${path} must declare its public function route.`);
  assert.ok(!/JSON\.stringify\s*\(\s*error\s*\)/.test(source), `${path} must never serialize raw errors.`);
  assert.ok(!/stack\s*:\s*error(?:\?|\.)?\.stack/.test(source), `${path} must never expose stack traces.`);
  assert.ok(!/return\s+(?:json|Response\.json)\s*\(\s*\{[^}]*error\s*:\s*error\?\.message/s.test(source), `${path} must not echo optional raw exception messages.`);
  assert.ok(!/return\s+(?:json|Response\.json)\s*\(\s*\{[^}]*error\s*:\s*error\.message\s*\|\|/s.test(source), `${path} must not use raw exception messages with a fallback.`);
}

for (const path of [
  'netlify/functions/community-moderation.mjs',
  'netlify/functions/community-report.mjs',
  'netlify/functions/configurations.mjs',
  'netlify/functions/dice-sets.mjs',
  'netlify/functions/save-dice-set.mjs',
  'netlify/functions/themes.mjs',
]) {
  const source = sources[path];
  assert.ok(source.includes('apiErrorResponse'), `${path} must use the shared safe API error boundary.`);
}

const shortcuts = sources['netlify/functions/shortcuts.mjs'];
for (const text of [
  'error instanceof ShortcutWorkspaceValidationError',
  'error instanceof ShortcutStorageError',
  "error: 'Shortcut persistence request failed.'",
]) assert.ok(shortcuts.includes(text), `Shortcut API safe error contract missing: ${text}`);

for (const [path, fallback] of [
  ['netlify/functions/dice-set-image.mjs', 'Unable to load dice-set image'],
  ['netlify/functions/theme-image.mjs', 'Unable to load theme image'],
  ['netlify/functions/me.mjs', 'Unable to read account.'],
  ['netlify/functions/dice-theme-assets.mjs', 'Invalid runtime dice theme.'],
]) {
  assert.ok(sources[path].includes(fallback), `${path} must retain its generic failure response.`);
}

for (const [path, marker] of [
  ['netlify/functions/auth.mjs', 'legacy-auth-retired'],
  ['netlify/functions/save-theme.mjs', 'legacy-theme-retired'],
]) assert.ok(sources[path].includes(marker), `${path} must remain a fixed retired endpoint.`);

const boundary = await read('netlify/functions/api-errors.mjs');
assert.ok(boundary.includes("code: 'request-failed'"), 'Shared API error boundary must provide a generic internal-failure code.');
assert.ok(boundary.includes('error instanceof PublicApiError'), 'Only typed public errors may preserve deliberate messages.');
const typedForbidden = apiErrorResponse(publicError('Administrator access required.', { status: 403, code: 'admin-required' }));
assert.deepEqual(typedForbidden, { status: 403, body: { error: 'Administrator access required.', code: 'admin-required' } });
const rawForbidden = new Error('provider-specific origin failure'); rawForbidden.status = 403;
assert.deepEqual(apiErrorResponse(rawForbidden), {
  status: 403,
  body: { error: 'Request origin is not allowed.', code: 'origin-not-allowed' },
});

console.log('Public API error contract passed: public endpoints do not serialize raw errors/stacks, typed public 403s preserve deliberate safe codes, raw origin failures stay sanitized, and specialized endpoints retain generic failures.');