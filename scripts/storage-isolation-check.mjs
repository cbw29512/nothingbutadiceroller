import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scopedStoreName } from '../netlify/functions/deploy-store.mjs';
import { toPublicLegacyTheme } from '../netlify/functions/legacy-theme-store.mjs';
import { validateTrayImage } from '../js/appearance/tray-image.mjs';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

assert.equal(scopedStoreName('example-store', { deploy: { context: 'production' } }), 'example-store');
for (const deployContext of ['deploy-preview', 'branch-deploy', 'dev', '']) {
  assert.equal(scopedStoreName('example-store', { deploy: { context: deployContext } }), 'example-store-nonprod');
}

const legacy = {
  ownerId: 'internal_user_123',
  themeId: 'theme_private_id',
  themeName: 'Old Theme',
  trayName: 'Old Tray',
  creator: 'private@example.com',
  customStyles: { baseColor: '#112233', diceColor: '#445566', numberColor: '#ffffff' },
  imageKey: 'users/internal_user_123/themes/theme_private_id_tray',
  imageAccessToken: 'secret123',
  isPublic: true,
};
const projected = toPublicLegacyTheme(legacy);
const serialized = JSON.stringify(projected);
assert.equal(projected.creator, 'Adventurer');
assert.match(projected.themeId, /^public_theme_[a-f0-9]{32}$/);
assert.match(projected.imageUrl, /^\/api\/theme-image\?public=public_theme_[a-f0-9]{32}&token=secret123$/);
assert.equal(serialized.includes('internal_user_123'), false);
assert.equal(serialized.includes('private@example.com'), false);
assert.equal(validateTrayImage({ kind: 'legacy', url: projected.imageUrl }).ok, true);

const [configs, shortcuts, saveTheme, themes, themeImage, authApi, netlifyConfig] = await Promise.all([
  read('netlify/functions/configurations.mjs'),
  read('netlify/functions/shortcuts.mjs'),
  read('netlify/functions/save-theme.mjs'),
  read('netlify/functions/themes.mjs'),
  read('netlify/functions/theme-image.mjs'),
  read('netlify/functions/auth.mjs'),
  read('netlify.toml'),
]);
for (const source of [configs, themes, themeImage]) {
  assert.match(source, /context/, 'Scoped APIs must receive Netlify function context.');
}
assert.match(configs, /openScopedStore\(STORE_NAME, context\)/);
assert.match(configs, /verifyRequestOrigin\(request\)/);
assert.match(configs, /VALID_TRAY_THEMES/);
assert.match(configs, /VALID_DIE_SKINS/);
assert.match(shortcuts, /\$\{STORE_NAME\}-nonprod/);
assert.match(shortcuts, /shortcutStore\(context\)/);
assert.match(saveTheme, /legacy-theme-retired/);
assert.match(saveTheme, /410/);
assert.doesNotMatch(saveTheme, /setJSON|user\.email|getStore/);
assert.match(themes, /toPublicLegacyTheme/);
assert.doesNotMatch(themes, /searchParams\.get\('owner'\)/);
assert.match(themeImage, /searchParams\.get\('public'\)/);
assert.match(themeImage, /theme\.isPublic/);
assert.match(themeImage, /'Cache-Control': 'no-store'/);
assert.doesNotMatch(themeImage, /max-age/);
assert.match(authApi, /legacy-auth-retired/);
assert.match(authApi, /410/);
assert.doesNotMatch(authApi, /login\(|signup\(|confirmEmail|recoverPassword|password/);
for (const required of [
  'X-Content-Type-Options = "nosniff"',
  'Referrer-Policy = "strict-origin-when-cross-origin"',
  'Permissions-Policy = "camera=(), microphone=(), geolocation=()"',
  'Content-Security-Policy = "object-src \'none\'; base-uri \'self\'"',
]) assert.ok(netlifyConfig.includes(required), `Missing static security header: ${required}`);

console.log('Release storage/surface checks passed: previews are isolated, retired legacy writers/auth cannot handle credentials, public legacy output is opaque/no-store, and safe static security headers are enforced.');
