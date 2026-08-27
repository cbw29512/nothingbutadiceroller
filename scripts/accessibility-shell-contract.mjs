import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureSkipLink } from '../js/accessibility.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function makeDocument({ includeMain = true, includeApp = true } = {}) {
  let inserted = null;
  let clickHandler = null;
  let focusOptions = null;
  const attributes = new Map();

  const main = includeMain ? {
    hasAttribute: (name) => attributes.has(name),
    setAttribute: (name, value) => attributes.set(name, value),
    focus: (options) => { focusOptions = options; },
  } : null;

  const parentNode = {
    insertBefore: (node, reference) => {
      assert.equal(reference, app);
      inserted = node;
    },
  };
  const app = includeApp ? { parentNode } : null;

  const doc = {
    getElementById(id) {
      if (id === 'skip-to-roller') return inserted;
      if (id === 'main-content') return main;
      if (id === 'app') return app;
      return null;
    },
    createElement(tagName) {
      assert.equal(tagName, 'a');
      return {
        id: '',
        className: '',
        href: '',
        textContent: '',
        addEventListener(type, handler) {
          assert.equal(type, 'click');
          clickHandler = handler;
        },
      };
    },
  };

  return {
    doc,
    attributes,
    get inserted() { return inserted; },
    click: () => clickHandler?.(),
    get focusOptions() { return focusOptions; },
  };
}

try {
  const fixture = makeDocument();
  const link = ensureSkipLink(fixture.doc);
  assert.equal(link, fixture.inserted, 'Skip link must be inserted immediately before the app shell.');
  assert.equal(link.id, 'skip-to-roller');
  assert.equal(link.className, 'skip-link');
  assert.equal(link.href, '#main-content');
  assert.equal(link.textContent, 'Skip to dice roller');
  assert.equal(fixture.attributes.get('tabindex'), '-1', 'Main roller landmark must accept programmatic focus.');
  assert.equal(ensureSkipLink(fixture.doc), link, 'Skip navigation must initialize idempotently.');

  fixture.click();
  await new Promise((resolveMicrotask) => queueMicrotask(resolveMicrotask));
  assert.deepEqual(fixture.focusOptions, { preventScroll: false }, 'Activating the skip link must move focus to the roller landmark.');

  assert.equal(ensureSkipLink(makeDocument({ includeMain: false }).doc), null, 'Missing main landmark must fail safely.');
  assert.equal(ensureSkipLink(makeDocument({ includeApp: false }).doc), null, 'Missing app shell must fail safely.');

  const css = await readFile(resolve(root, 'mobile.css'), 'utf8');
  assert.match(css, /\.skip-link\s*\{/);
  assert.match(css, /\.skip-link:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.skip-link/);

  const app = await readFile(resolve(root, 'js/app.js'), 'utf8');
  assert.match(app, /ensureSkipLink\(\)/, 'App boot must initialize bypass navigation.');

  console.log('Accessibility shell contract passed: keyboard bypass navigation is idempotent, focus-moving, visibly focusable, reduced-motion safe, and fails closed when shell landmarks are unavailable.');
} catch (error) {
  console.error('Accessibility shell contract failed:', error);
  process.exitCode = 1;
}
