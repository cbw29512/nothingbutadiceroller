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
    target: target(),
    ...overrides,
  };
}

function target(tagName = 'DIV', { blocked = false, href = false, contentEditable = false } = {}) {
  return {
    tagName,
    isContentEditable: contentEditable,
    hasAttribute: (name) => name === 'href' && href,
    closest: () => (blocked ? {} : null),
  };
}

try {
  assert.equal(shouldHandleGlobalRollShortcut(event()), true, 'Ctrl+Enter on a non-interactive roller surface should remain a valid quick roll.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ defaultPrevented: true })), false, 'Already-handled key events must not trigger a second roll.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('INPUT') })), false, 'Text inputs must never trigger the global roll shortcut.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('TEXTAREA') })), false, 'Textareas must never trigger the global roll shortcut.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('SELECT') })), false, 'Select controls must never trigger the global roll shortcut.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('BUTTON') })), false, 'Focused buttons must keep their own keyboard action.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('A', { href: true }) })), false, 'Focused links must keep their own keyboard action.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('SUMMARY') })), false, 'Focused disclosure controls must keep their own keyboard action.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('DIV', { contentEditable: true }) })), false, 'Contenteditable fields must never trigger the global roll shortcut.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ target: target('SPAN', { blocked: true }) })), false, 'Descendants of interactive, modal, or custom-die controls must never trigger a background roll.');
  assert.equal(shouldHandleGlobalRollShortcut(event({ key: 'Space' })), false);
  assert.equal(shouldHandleGlobalRollShortcut(event({ ctrlKey: false })), false);
  assert.equal(shouldHandleGlobalRollShortcut(event({ shiftKey: true })), false);
  assert.equal(shouldHandleGlobalRollShortcut(event({ altKey: true })), false);
  assert.equal(shouldHandleGlobalRollShortcut(event({ metaKey: true })), false);

  console.log('Keyboard shortcut contract passed: Ctrl+Enter stays available on non-interactive roller surfaces and never hijacks text entry, buttons, links, disclosures, handled events, modal controls, or modified shortcuts.');
} catch (error) {
  console.error('Keyboard shortcut contract failed:', error);
  process.exitCode = 1;
}
