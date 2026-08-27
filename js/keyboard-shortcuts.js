const BLOCKED_ROLL_SHORTCUT_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '.drawer',
  '.custom-die-popover',
  '.desktop-custom-die-popover',
].join(',');

function isBlockedRollShortcutTarget(target) {
  if (!target) return false;

  const tagName = String(target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) return true;
  if (target.isContentEditable === true) return true;

  try {
    return typeof target.closest === 'function'
      && Boolean(target.closest(BLOCKED_ROLL_SHORTCUT_SELECTOR));
  } catch (error) {
    console.warn('Failed to inspect keyboard shortcut target:', error);
    return true;
  }
}

export function shouldHandleGlobalRollShortcut(event) {
  if (!event || event.defaultPrevented) return false;
  if (event.key !== 'Enter' || event.ctrlKey !== true) return false;
  if (event.altKey || event.metaKey || event.shiftKey) return false;
  return !isBlockedRollShortcutTarget(event.target);
}
