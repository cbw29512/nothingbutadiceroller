import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

try {
  const [html, accountCss, app] = await Promise.all([
    read('index.html'),
    read('account.css'),
    read('js/app.js'),
  ]);

  assert.equal(/@import\s+/i.test(accountCss), false, 'Account CSS must not import another production stylesheet.');
  assert.ok(html.includes('id="community-styles" rel="stylesheet" href="/community.css"'), 'Main page must own the Community stylesheet link.');
  assert.ok(html.includes('id="custom-controls-styles" rel="stylesheet" href="/custom.css"'), 'Main page must own the custom-control stylesheet link.');
  assert.equal(app.includes("ensureStylesheet('community-styles'"), false, 'Runtime must not duplicate the prelinked Community stylesheet.');
  assert.equal(app.includes("ensureStylesheet('custom-controls-styles'"), false, 'Runtime must not duplicate the prelinked custom-control stylesheet.');
  assert.ok(app.includes("ensureStylesheet('shortcut-toolbar-styles', '/shortcut-toolbar.css')"), 'Progressive shortcut toolbar stylesheet loading must remain explicit.');

  console.log('Stylesheet loading passed: prelinked production styles are single-sourced, CSS imports are eliminated, and only the progressive shortcut toolbar is injected at runtime.');
} catch (error) {
  console.error('Stylesheet loading failed:', error);
  process.exitCode = 1;
}
