import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }

try {
  const [html, accountCss, customCss, customizeCss, app, ...polishModules] = await Promise.all([
    read('index.html'),
    read('account.css'),
    read('custom.css'),
    read('customize.css'),
    read('js/app.js'),
    read('js/mobile-header-menu.js'),
    read('js/custom-roll.js'),
    read('js/history-actions.js'),
    read('js/mobile-dice-quantity.js'),
    read('js/appearance/studio-mobile-navigation.mjs'),
    read('js/appearance/studio-preview-geometry.mjs'),
    read('js/appearance/studio-progressive-sections.mjs'),
    read('js/appearance/studio-action-workflow.mjs'),
  ]);

  assert.equal(/@import\s+/i.test(accountCss), false, 'Account CSS must not import another production stylesheet.');
  assert.ok(html.includes('id="community-styles" rel="stylesheet" href="/community.css"'), 'Main page must own the Community stylesheet link.');
  assert.ok(html.includes('id="custom-controls-styles" rel="stylesheet" href="/custom.css"'), 'Main page must own the custom-control stylesheet link.');
  assert.equal(app.includes("ensureStylesheet('community-styles'"), false, 'Runtime must not duplicate the prelinked Community stylesheet.');
  assert.equal(app.includes("ensureStylesheet('custom-controls-styles'"), false, 'Runtime must not duplicate the prelinked custom-control stylesheet.');
  assert.ok(app.includes("ensureStylesheet('shortcut-toolbar-styles', '/shortcut-toolbar.css')"), 'Progressive shortcut toolbar stylesheet loading must remain explicit.');

  for (const source of polishModules) {
    assert.equal(source.includes("createElement('style')"), false, 'Final polish modules must not inject inline style elements under the production CSP.');
    assert.equal(source.includes('createElement("style")'), false, 'Final polish modules must not inject inline style elements under the production CSP.');
  }

  for (const selector of [
    '.mobile-header-more',
    '.custom-random-proof',
    '.history-actions',
    '.mobile-die-btn[data-type].has-quantity',
  ]) {
    assert.ok(customCss.includes(selector), `custom.css must statically own ${selector}.`);
  }
  for (const selector of [
    '.studio-mobile-nav',
    '.studio-preview-die>[data-preview-geometry-art]',
    '.studio-editor-section',
    '.studio-primary-action-bar',
  ]) {
    assert.ok(customizeCss.includes(selector), `customize.css must statically own ${selector}.`);
  }

  console.log('Stylesheet loading passed: production CSS is prelinked/static, final polish modules are CSP-safe, and only the progressive shortcut toolbar loads an approved same-origin stylesheet at runtime.');
} catch (error) {
  console.error('Stylesheet loading failed:', error);
  process.exitCode = 1;
}
