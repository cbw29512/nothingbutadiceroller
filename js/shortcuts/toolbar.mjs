import { BUILTIN_ICON_IDS, MAX_SHORTCUTS } from './constants.mjs';
import { getShortcutIconGlyph } from './icons.mjs';

export const SHORTCUTS_PER_ROW = 8;
export const MAX_SHORTCUT_ROWS = 3;
export const SHORTCUT_LONG_PRESS_MS = 500;

const ITEM_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function assertToolbarItems(items) {
  if (!Array.isArray(items)) throw new Error('Shortcut toolbar items must be an array.');
  if (items.length > MAX_SHORTCUTS) throw new Error(`Shortcut toolbar cannot exceed ${MAX_SHORTCUTS} items.`);
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Shortcut toolbar item ${index} must be an object.`);
    if (typeof item.id !== 'string' || !ITEM_ID_RE.test(item.id)) throw new Error(`Shortcut toolbar item ${index} has an invalid id.`);
    if (ids.has(item.id)) throw new Error(`Shortcut toolbar item id must be unique: ${item.id}`);
    ids.add(item.id);
    if (typeof item.name !== 'string' || item.name.trim().length < 1 || item.name.trim().length > 80) {
      throw new Error(`Shortcut toolbar item ${item.id} has an invalid name.`);
    }
    if (!BUILTIN_ICON_IDS.includes(item.icon)) throw new Error(`Shortcut toolbar item ${item.id} has an invalid icon.`);
  }
  return items;
}

export function getShortcutToolbarRowCount(itemCount) {
  if (!Number.isInteger(itemCount) || itemCount < 0 || itemCount > MAX_SHORTCUTS) {
    throw new Error(`Shortcut count must be an integer from 0 to ${MAX_SHORTCUTS}.`);
  }
  return Math.ceil(itemCount / SHORTCUTS_PER_ROW);
}

export function getShortcutToolbarRows(items) {
  assertToolbarItems(items);
  const rows = [];
  for (let start = 0; start < items.length; start += SHORTCUTS_PER_ROW) {
    rows.push(Object.freeze(items.slice(start, start + SHORTCUTS_PER_ROW)));
  }
  return Object.freeze(rows);
}

export function moveShortcutToolbarItem(items, itemId, offset) {
  assertToolbarItems(items);
  if (!Number.isInteger(offset) || offset === 0) return Object.freeze([...items]);
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) throw new Error(`Unknown shortcut toolbar item: ${itemId}`);
  const target = Math.max(0, Math.min(items.length - 1, index + offset));
  if (target === index) return Object.freeze([...items]);
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return Object.freeze(next);
}

export function isShortcutToolbarItemDisabled(activeId, itemId) {
  return Boolean(activeId && activeId !== itemId);
}

export function createShortcutToolbarState(activeId = null) {
  return Object.freeze({ activeId: activeId || null });
}

export function activateShortcutToolbarState(state, itemId) {
  const activeId = state?.activeId || null;
  if (activeId && activeId !== itemId) return createShortcutToolbarState(activeId);
  return createShortcutToolbarState(itemId);
}

export function clearShortcutToolbarState() {
  return createShortcutToolbarState(null);
}

export function classifyShortcutPress(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) throw new Error('Press duration must be a non-negative number.');
  return durationMs >= SHORTCUT_LONG_PRESS_MS ? 'long' : 'short';
}

export function createShortcutPressController({
  onActivate,
  onInfo,
  onInfoHide,
  longPressMs = SHORTCUT_LONG_PRESS_MS,
  schedule = setTimeout,
  cancel = clearTimeout,
  defer = (callback) => setTimeout(callback, 0),
} = {}) {
  if (!Number.isFinite(longPressMs) || longPressMs < 1) throw new Error('Long-press threshold must be positive.');
  let timer = null;
  let pointerActive = false;
  let infoShownByHold = false;
  let suppressClick = false;

  const clearTimer = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };

  return Object.freeze({
    pointerDown() {
      pointerActive = true;
      infoShownByHold = false;
      clearTimer();
      timer = schedule(() => {
        timer = null;
        if (!pointerActive) return;
        infoShownByHold = true;
        onInfo?.('hold');
      }, longPressMs);
      return true;
    },
    pointerUp() {
      if (!pointerActive) return false;
      pointerActive = false;
      clearTimer();
      if (infoShownByHold) onInfoHide?.('hold');
      infoShownByHold = false;
      suppressClick = true;
      onActivate?.('pointer');
      defer(() => { suppressClick = false; });
      return true;
    },
    pointerCancel() {
      if (!pointerActive && !infoShownByHold) return false;
      pointerActive = false;
      clearTimer();
      if (infoShownByHold) onInfoHide?.('hold');
      infoShownByHold = false;
      suppressClick = false;
      return true;
    },
    click() {
      if (suppressClick) {
        suppressClick = false;
        return false;
      }
      onActivate?.('keyboard-or-click');
      return true;
    },
    focus() {
      onInfo?.('focus');
    },
    blur() {
      onInfoHide?.('focus');
    },
    getState() {
      return Object.freeze({ pointerActive, infoShownByHold, suppressClick });
    },
  });
}

function bindPress(button, item, { onActivate, onInfo, onInfoHide }) {
  const controller = createShortcutPressController({
    onActivate: (source) => onActivate?.(item, { source }),
    onInfo: (source) => onInfo?.(item, button, source),
    onInfoHide: (source) => onInfoHide?.(item, button, source),
  });

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || button.disabled) return;
    controller.pointerDown();
  });
  button.addEventListener('pointerup', (event) => {
    if (event.button !== 0 || button.disabled) return;
    controller.pointerUp();
  });
  button.addEventListener('pointercancel', () => controller.pointerCancel());
  button.addEventListener('click', () => {
    if (!button.disabled) controller.click();
  });
  button.addEventListener('focus', () => controller.focus());
  button.addEventListener('blur', () => controller.blur());
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') controller.blur();
  });
}

export function renderShortcutToolbar(container, items, {
  activeId = null,
  onActivate,
  onInfo,
  onInfoHide,
  toolbarLabel = 'Saved roll shortcuts',
} = {}) {
  if (!(container instanceof HTMLElement)) throw new Error('Shortcut toolbar container must be an HTMLElement.');
  assertToolbarItems(items);
  if (activeId && !items.some((item) => item.id === activeId)) throw new Error(`Active shortcut is not in the toolbar: ${activeId}`);

  const rows = getShortcutToolbarRows(items);
  container.replaceChildren();
  container.hidden = rows.length === 0;
  container.setAttribute('aria-label', toolbarLabel);
  container.dataset.rowCount = String(rows.length);
  if (!rows.length) return Object.freeze({ rowCount: 0, buttonCount: 0 });

  rows.forEach((row, rowIndex) => {
    const rowElement = document.createElement('div');
    rowElement.className = 'shortcut-toolbar-row';
    rowElement.setAttribute('role', 'group');
    rowElement.setAttribute('aria-label', `Shortcut row ${rowIndex + 1} of ${rows.length}`);

    row.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shortcut-icon-btn';
      button.dataset.shortcutId = item.id;
      button.setAttribute('aria-label', item.name.trim());
      button.setAttribute('aria-pressed', String(activeId === item.id));
      button.title = item.name.trim();
      button.disabled = isShortcutToolbarItemDisabled(activeId, item.id);
      if (activeId === item.id) button.classList.add('active');

      const icon = document.createElement('span');
      icon.className = 'shortcut-icon-glyph';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = getShortcutIconGlyph(item.icon);
      button.append(icon);

      bindPress(button, item, { onActivate, onInfo, onInfoHide });
      rowElement.append(button);
    });

    container.append(rowElement);
  });

  return Object.freeze({ rowCount: rows.length, buttonCount: items.length });
}
