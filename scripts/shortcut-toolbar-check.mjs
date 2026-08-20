import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BUILTIN_ICON_IDS,
  MAX_SHORTCUTS,
  SHORTCUT_ICON_GLYPHS,
  SHORTCUT_LONG_PRESS_MS,
  activateShortcutToolbarState,
  classifyShortcutPress,
  clearShortcutToolbarState,
  createShortcutPressController,
  getShortcutToolbarRowCount,
  getShortcutToolbarRows,
  isShortcutToolbarItemDisabled,
  moveShortcutToolbarItem,
} from '../js/shortcuts/index.mjs';

const items = BUILTIN_ICON_IDS.map((icon, index) => ({
  id: `item-${index + 1}`,
  name: `Shortcut ${index + 1}`,
  icon,
}));

assert.equal(items.length, MAX_SHORTCUTS);
assert.equal(Object.keys(SHORTCUT_ICON_GLYPHS).length, MAX_SHORTCUTS);
assert.equal(new Set(Object.values(SHORTCUT_ICON_GLYPHS)).size, MAX_SHORTCUTS);

const rowCases = new Map([
  [0, 0], [1, 1], [8, 1], [9, 2], [16, 2], [17, 3], [24, 3],
]);
for (const [count, expectedRows] of rowCases) {
  assert.equal(getShortcutToolbarRowCount(count), expectedRows, `${count} shortcuts should create ${expectedRows} row(s)`);
  const rows = getShortcutToolbarRows(items.slice(0, count));
  assert.equal(rows.length, expectedRows);
  assert.ok(rows.every((row) => row.length >= 1 && row.length <= 8));
  assert.equal(rows.flat().length, count);
}
assert.throws(() => getShortcutToolbarRowCount(25), /0 to 24/);
assert.throws(() => getShortcutToolbarRows([...items, { id: 'item-25', name: 'Too many', icon: 'dice' }]), /cannot exceed 24/);

const nine = items.slice(0, 9);
const movedAcrossRow = moveShortcutToolbarItem(nine, 'item-9', -1);
assert.equal(movedAcrossRow[7].id, 'item-9');
assert.equal(movedAcrossRow[8].id, 'item-8');
const movedBack = moveShortcutToolbarItem(movedAcrossRow, 'item-9', 1);
assert.deepEqual(movedBack.map((item) => item.id), nine.map((item) => item.id));
assert.equal(moveShortcutToolbarItem(nine, 'item-1', -1)[0].id, 'item-1');
assert.equal(moveShortcutToolbarItem(nine, 'item-9', 50)[8].id, 'item-9');

let state = clearShortcutToolbarState();
assert.equal(state.activeId, null);
assert.equal(isShortcutToolbarItemDisabled(state.activeId, 'item-2'), false);
state = activateShortcutToolbarState(state, 'item-1');
assert.equal(state.activeId, 'item-1');
assert.equal(isShortcutToolbarItemDisabled(state.activeId, 'item-1'), false);
assert.equal(isShortcutToolbarItemDisabled(state.activeId, 'item-2'), true);
state = activateShortcutToolbarState(state, 'item-2');
assert.equal(state.activeId, 'item-1', 'A different shortcut cannot replace an active shortcut.');
state = clearShortcutToolbarState();
assert.equal(isShortcutToolbarItemDisabled(state.activeId, 'item-2'), false);

assert.equal(SHORTCUT_LONG_PRESS_MS, 500);
assert.equal(classifyShortcutPress(499), 'short');
assert.equal(classifyShortcutPress(500), 'long');
assert.equal(classifyShortcutPress(800), 'long');

function fakePressHarness() {
  let scheduled = null;
  let deferred = null;
  let activations = [];
  let info = [];
  let hidden = [];
  let cancelled = 0;
  const controller = createShortcutPressController({
    onActivate: (source) => activations.push(source),
    onInfo: (source) => info.push(source),
    onInfoHide: (source) => hidden.push(source),
    schedule(callback, delay) {
      assert.equal(delay, 500);
      scheduled = callback;
      return 1;
    },
    cancel() {
      cancelled += 1;
      scheduled = null;
    },
    defer(callback) {
      deferred = callback;
    },
  });
  return {
    controller,
    fireHold: () => scheduled?.(),
    fireDeferred: () => deferred?.(),
    get activations() { return activations; },
    get info() { return info; },
    get hidden() { return hidden; },
    get cancelled() { return cancelled; },
  };
}

const shortPress = fakePressHarness();
shortPress.controller.pointerDown();
shortPress.controller.pointerUp();
assert.deepEqual(shortPress.activations, ['pointer']);
assert.deepEqual(shortPress.info, []);
assert.equal(shortPress.controller.click(), false, 'Synthetic browser click after pointer release must be suppressed.');
assert.deepEqual(shortPress.activations, ['pointer']);
shortPress.fireDeferred();

const longPress = fakePressHarness();
longPress.controller.pointerDown();
longPress.fireHold();
assert.deepEqual(longPress.info, ['hold']);
longPress.controller.pointerUp();
assert.deepEqual(longPress.hidden, ['hold']);
assert.deepEqual(longPress.activations, ['pointer'], 'Long-press release must count as exactly one activation.');
assert.equal(longPress.controller.click(), false);
assert.deepEqual(longPress.activations, ['pointer']);

const cancelledPress = fakePressHarness();
cancelledPress.controller.pointerDown();
cancelledPress.fireHold();
cancelledPress.controller.pointerCancel();
assert.deepEqual(cancelledPress.activations, []);
assert.deepEqual(cancelledPress.hidden, ['hold']);

const keyboardPress = fakePressHarness();
keyboardPress.controller.focus();
assert.deepEqual(keyboardPress.info, ['focus']);
assert.equal(keyboardPress.controller.click(), true);
assert.deepEqual(keyboardPress.activations, ['keyboard-or-click']);
keyboardPress.controller.blur();
assert.deepEqual(keyboardPress.hidden, ['focus']);

const toolbarCss = await readFile(new URL('../shortcut-toolbar.css', import.meta.url), 'utf8');
const harnessHtml = await readFile(new URL('../shortcut-harness.html', import.meta.url), 'utf8');
const harnessJs = await readFile(new URL('../js/shortcut-harness.js', import.meta.url), 'utf8');
const mainHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const mainApp = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

for (const required of [
  'grid-template-columns:repeat(8,minmax(0,44px))',
  '@media(max-width:420px)',
  'grid-template-columns:repeat(8,minmax(0,1fr))',
  '.shortcut-toolbar[hidden]{display:none}',
  '.shortcut-icon-btn:focus-visible',
  '@media(prefers-reduced-motion:reduce)',
]) assert.ok(toolbarCss.includes(required), `Toolbar CSS contract missing: ${required}`);

for (const required of [
  'name="robots" content="noindex,nofollow"',
  'data-count="0"', 'data-count="8"', 'data-count="9"', 'data-count="16"', 'data-count="17"', 'data-count="24"',
  'id="shortcut-toolbar-harness"',
  'id="harness-move-left"',
  'id="harness-move-right"',
]) assert.ok(harnessHtml.includes(required), `Harness HTML contract missing: ${required}`);

assert.ok(harnessJs.includes('renderShortcutToolbar'));
assert.ok(harnessJs.includes('moveShortcutToolbarItem'));
assert.ok(!mainHtml.includes('shortcut-toolbar.css'), 'Phase 4 must not add the toolbar stylesheet to the live roller.');
assert.ok(!mainHtml.includes('shortcut-toolbar-harness'), 'Phase 4 must not add shortcut toolbar markup to the live roller.');
assert.ok(!mainApp.includes("./shortcuts/toolbar.mjs"), 'Phase 4 must not import the toolbar into the live roller app.');

console.log('Shortcut toolbar checks passed.');
