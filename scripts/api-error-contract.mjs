import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { apiErrorResponse, publicError } from '../netlify/functions/api-errors.mjs';

const functionsDirectory = new URL('../netlify/functions/', import.meta.url);
async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

const functionEntries = await readdir(functionsDirectory, { withFileTypes: true });
const functionSources = {};
for (const entry of functionEntries) {
  if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
  const path = `netlify/functions/${entry.name}`;
  functionSources[path] = await read(path);
}

const publicEndpointPaths = Object.entries(functionSources)
  .filter(([, source]) => /export const config\s*=\s*\{[\s\S]*?path\s*:\s*['"]\/api\//.test(source))
  .map(([path]) => path)
  .sort();
const sources = Object.fromEntries(publicEndpointPaths.map((path) => [path, functionSources[path]]));

assert.ok(publicEndpointPaths.length >= 14, `Expected the full public API surface; discovered only ${publicEndpointPaths.length} endpoint(s).`);
assert.ok(publicEndpointPaths.includes('netlify/functions/account-data.mjs'), 'Account-data export/deletion endpoint must be covered by the public API error audit.');

for (const [path, source] of Object.entries(sources)) {
  assert.ok(source.includes('export const config'), `${path} must declare its public function route.`);
  assert.ok(!/JSON\.stringify\s*\(\s*error\s*\)/.test(source), `${path} must never serialize raw errors.`);
  assert.ok(!/stack\s*:\s*error(?:\?|\.)?\.stack/.test(source), `${path} must never expose stack traces.`);
  assert.ok(!/return\s+(?:json|Response\.json)\s*\(\s*\{[^}]*error\s*:\s*error\?\.message/s.test(source), `${path} must not echo optional raw exception messages.`);
  assert.ok(!/return\s+(?:json|Response\.json)\s*\(\s*\{[^}]*error\s*:\s*error\.message\s*\|\|/s.test(source), `${path} must not use raw exception messages with a fallback.`);
  assert.ok(!/new Response\s*\(\s*error(?:\?|\.)?\.message/.test(source), `${path} must not expose raw exception text in non-JSON responses.`);
}

const sharedBoundaryEndpoints = [
  'netlify/functions/account-data.mjs',
  'netlify/functions/community-moderation.mjs',
  'netlify/functions/community-report.mjs',
  'netlify/functions/configurations.mjs',
  'netlify/functions/dice-sets.mjs',
  'netlify/functions/save-dice-set.mjs',
  'netlify/functions/themes.mjs',
];
for (const path of sharedBoundaryEndpoints) {
  assert.ok(sources[path], `${path} must remain a discovered public API endpoint.`);
  assert.ok(sources[path].includes('apiErrorResponse'), `${path} must use the shared safe API error boundary.`);
}

const shortcuts = sources['netlify/functions/shortcuts.mjs'];
for (const text of [
  'error instanceof ShortcutWorkspaceValidationError',
  'error instanceof ShortcutStorageError',
  "error: 'Shortcut persistence request failed.'",
]) assert.ok(shortcuts?.includes(text), `Shortcut API safe error contract missing: ${text}`);

const genericResponseEndpoints = [
  ['netlify/functions/dice-set-image.mjs', 'Unable to load dice-set image'],
  ['netlify/functions/theme-image.mjs', 'Unable to load theme image'],
  ['netlify/functions/me.mjs', 'Unable to read account.'],
  ['netlify/functions/dice-theme-assets.mjs', 'Invalid runtime dice theme.'],
];
for (const [path, fallback] of genericResponseEndpoints) {
  assert.ok(sources[path], `${path} must remain a discovered public API endpoint.`);
  assert.ok(sources[path].includes(fallback), `${path} must retain its generic failure response.`);
}

const retiredEndpoints = [
  ['netlify/functions/auth.mjs', 'legacy-auth-retired'],
  ['netlify/functions/save-theme.mjs', 'legacy-theme-retired'],
];
for (const [path, marker] of retiredEndpoints) {
  assert.ok(sources[path], `${path} must remain a discovered public API endpoint.`);
  assert.ok(sources[path].includes(marker), `${path} must remain a fixed retired endpoint.`);
}

const classifiedEndpoints = new Set([
  ...sharedBoundaryEndpoints,
  'netlify/functions/shortcuts.mjs',
  ...genericResponseEndpoints.map(([path]) => path),
  ...retiredEndpoints.map(([path]) => path),
]);
assert.deepEqual(
  publicEndpointPaths.filter((path) => !classifiedEndpoints.has(path)),
  [],
  'Every public API endpoint must have an explicit safe error-response classification.',
);

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

console.log(`Public API error contract passed: all ${publicEndpointPaths.length} discovered /api endpoints are explicitly classified, raw exceptions/stacks are blocked, typed public errors preserve only deliberate safe details, and account-data privacy routes are covered.`);
