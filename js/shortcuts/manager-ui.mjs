import { BUILTIN_ICON_IDS, SHORTCUT_CATEGORIES } from './constants.mjs';
import { getShortcutIconGlyph } from './icons.mjs';
import { managerContext } from './manager-context.mjs';

export function element(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function setStatus(message, tone = '') {
  const host = document.getElementById('manager-status');
  if (!host) return;
  host.textContent = message;
  host.className = `status-line manager-status${tone ? ` ${tone}` : ''}`;
}

export function guard(action) {
  return async (...args) => {
    try {
      return await action(...args);
    } catch (error) {
      console.error('Shortcut manager action failed:', error);
      setStatus(error?.message || 'Shortcut manager action failed.', 'error');
      return null;
    }
  };
}

export function selectWithOptions(values, selected, labeler = (value) => value) {
  const select = element('select', 'manager-select');
  for (const value of values) {
    const option = element('option', '', labeler(value));
    option.value = value;
    option.selected = value === selected;
    select.append(option);
  }
  return select;
}

export function markDirty(value = true) {
  managerContext.dirty = Boolean(value);
  const save = document.getElementById('save-workspace');
  const label = document.getElementById('save-state-label');
  if (save) save.disabled = !managerContext.dirty || !managerContext.accountUser || managerContext.demoMode;
  if (label) {
    label.textContent = managerContext.demoMode
      ? 'Demo mode — changes stay in memory'
      : managerContext.dirty ? 'Unsaved changes' : 'No unsaved changes';
  }
}

export function renderTabs() {
  document.querySelectorAll('.manager-tab').forEach((button) => {
    const selected = button.dataset.tab === managerContext.activeTab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.manager-tab-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.panel !== managerContext.activeTab);
  });
}

export function renderOptions() {
  const critical = document.getElementById('critical-mode');
  const preferred = document.getElementById('preferred-ruleset');
  const note = document.getElementById('custom-crit-note');
  if (critical) critical.value = managerContext.options.criticalMode;
  if (preferred) preferred.value = managerContext.options.preferredRuleset;
  if (note) note.classList.toggle('hidden', managerContext.options.criticalMode !== 'custom');
}

export function renderSaveState() {
  const revision = document.getElementById('workspace-revision');
  if (revision) revision.textContent = `Revision ${managerContext.serverState?.workspace?.revision ?? 0}`;
  markDirty(managerContext.dirty);
}

export function renderIconAndCategoryOptions() {
  const icon = document.getElementById('homebrew-icon');
  const category = document.getElementById('homebrew-category');
  if (icon && !icon.options.length) {
    for (const id of BUILTIN_ICON_IDS) {
      const option = element('option', '', `${getShortcutIconGlyph(id)} ${id}`);
      option.value = id;
      icon.append(option);
    }
    icon.value = 'dice';
  }
  if (category && !category.options.length) {
    for (const value of SHORTCUT_CATEGORIES) {
      const option = element('option', '', value);
      option.value = value;
      category.append(option);
    }
    category.value = 'custom';
  }
}
