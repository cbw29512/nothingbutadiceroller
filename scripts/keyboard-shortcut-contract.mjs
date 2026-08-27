import assert from 'node:assert/strict';
import { shouldHandleGlobalRollShortcut } from '../js/keyboard-shortcuts.js';

function event(overrides = {}) {
  return {
    key: 'Enter',
    ctrlKey: true,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    target: { tagName: 'DIV', closest: () => null },
    ...overrides,
  };
}

function target(tagName = 'DIV', blocked = false) {
  return {
    tagName,
    isContentEditable: false,
    closest: () => (blocked ? {} : null),
  };
}

try {
  assert.equal(shouldHandleGlobalRollShortcut(event()), true, 'Ctrl+Enter on the roller surface should remain a valid quick roll.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ defaultPrevented: true })), false, 'Already-handled key events must not trigger a second roll.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('INPUT') })), false, 'Text inputs must never trigger the global roll shortcut.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('TEXTAREA') })), false, 'Textareas must never trigger the global roll shortcut.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('SELECT') })), false, 'Select controls must never trigger the global roll shortcut.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: { ...target(), isContentEditable: true } })), false, 'Contenteditable fields must never trigger the global roll shortcut.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('BUTTON', true) })), false, 'Controls inside drawers or custom-die popovers must never trigger a background roll.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ key: 'Space' })), false);
  assert.equal(shouldHandleGlobalRollShortcut(event({ ctrlKey: false })), false);
  assert.equal(shouldHandleGlobalRollShortcut(event({ shiftKey: true })), false);
  assert.equal(shouldHandleGlobalRollShortcut(event({ altKey: true })), false);
  assert.equal(shouldHandleGlobalRollShortcut(event({ metaKey: true })), false);

  console.log('Keyboard shortcut contract passed: Ctrl+Enter stays available on the roller and is blocked in text, handled, modified, modal, and custom-die contexts.');
} catch (error) {
  console.error('Keyboard shortcut contract failed:', error);
  process.exitCode = 1;
}
