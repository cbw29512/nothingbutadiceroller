import { refreshAccountUser } from './account-api.js';
import {
  BUILTIN_ICON_IDS,
  MAX_SHORTCUTS,
  ROLLER_DIE_SIDES,
  SHORTCUT_CATEGORIES,
} from './shortcuts/constants.mjs';
import { getShortcutIconGlyph } from './shortcuts/icons.mjs';
import {
  DEFAULT_SHORTCUT_OPTIONS,
  hydrateShortcutSlot,
  normalizeShortcutOptions,
  normalizeShortcutSlots,
} from './shortcuts/persistence.mjs';
import {
  loadShortcutWorkspace,
  saveShortcutWorkspace,
  ShortcutPersistenceError,
} from './shortcuts/persistence-client.mjs';
import { getRawCatalog } from './shortcuts/raw/index.mjs';
import {
  appendShortcutSlot,
  createFlexManagerSlot,
  createRawManagerSlot,
  moveShortcutSlot,
  removeShortcutSlot,
  updateManagerOptions,
} from './shortcuts/manager-state.mjs';
import { renderShortcutToolbar } from './shortcuts/toolbar.mjs';

let accountUser = null;
let serverState = null;
let shortcuts = [];
let options = DEFAULT_SHORTCUT_OPTIONS;
let selectedSlotId = null;
let dirty = false;
let demoMode = false;
let activeTab = '2024';
let nextGroupNumber = 1;
let builderGroups = [createBuilderGroup('damage', 1)];
const rawDrafts = new Map();

function createBuilderGroup(kind, number) {
  return {
    id: `group-${number}`,
    label: kind === 'attack' ? `Attack ${number}` : `Damage ${number}`,
    kind,
    count: 1,
    sides: kind === 'attack' ? 20 : 6,
    modifier: 0,
    repeat: 1,
    damageType: kind === 'damage' ? 'slashing' : '',
    critEligible: false,
    triggerGroupId: '',
  };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setStatus(message, tone = '') {
  const host = document.getElementById('manager-status');
  if (!host) return;
  host.textContent = message;
  host.className = `status-line manager-status${tone ? ` ${tone}` : ''}`;
}

function guard(action) {
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

function isDeployPreviewDemo() {
  try {
    return location.hostname.startsWith('deploy-preview-')
      && new URLSearchParams(location.search).get('shortcutDemo') === '1';
  } catch {
    return false;
  }
}

function demoSlots() {
  return normalizeShortcutSlots([
    { id: 'demo-fireball', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fireball', baseVariantId: 'slot-3' },
    { id: 'demo-fire-bolt', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fire-bolt', baseVariantId: 'tier-2', inputs: { toHit: 9 } },
    { id: 'demo-scorching-ray', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'scorching-ray', baseVariantId: 'slot-2', inputs: { toHit: 9 } },
    { id: 'demo-magic-missile', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'magic-missile', baseVariantId: 'slot-1' },
  ]);
}

function canEdit() {
  return Boolean(accountUser || demoMode);
}

function setDirty(value = true) {
  dirty = Boolean(value);
  const save = document.getElementById('save-workspace');
  const label = document.getElementById('save-state-label');
  if (save) save.disabled = !dirty || !accountUser || demoMode;
  if (label) {
    label.textContent = demoMode
      ? 'Demo mode — changes stay in memory'
      : dirty ? 'Unsaved changes' : 'No unsaved changes';
  }
}

function slotName(slot) {
  try {
    return hydrateShortcutSlot(slot).definition.name;
  } catch (error) {
    console.error('Failed to resolve shortcut name:', error);
    return slot.id;
  }
}

function renderOrganizer() {
  const toolbar = document.getElementById('manager-toolbar');
  const empty = document.getElementById('empty-toolbar-note');
  const count = document.getElementById('shortcut-count');
  if (!toolbar || !empty || !count) return;

  count.textContent = `${shortcuts.length} / ${MAX_SHORTCUTS}`;
  empty.hidden = shortcuts.length > 0;
  renderShortcutToolbar(toolbar, shortcuts.map((slot) => ({
    id: slot.id,
    name: slotName(slot),
    icon: slot.icon,
  })), {
    onActivate: (item) => {
      selectedSlotId = item.id;
      renderOrganizer();
    },
    onInfo: (item) => setStatus(`${item.name} selected for toolbar management.`),
    onInfoHide: () => {},
    toolbarLabel: 'Toolbar organizer',
  });

  if (selectedSlotId && !shortcuts.some((slot) => slot.id === selectedSlotId)) selectedSlotId = null;
  toolbar.querySelector(`[data-shortcut-id="${CSS.escape(selectedSlotId || '')}"]`)?.classList.add('manager-selected');

  const selected = shortcuts.find((slot) => slot.id === selectedSlotId);
  const name = document.getElementById('selected-shortcut-name');
  const left = document.getElementById('move-shortcut-left');
  const right = document.getElementById('move-shortcut-right');
  const remove = document.getElementById('remove-shortcut');
  const index = selected ? shortcuts.findIndex((slot) => slot.id === selected.id) : -1;
  if (name) name.textContent = selected ? slotName(selected) : 'Select a shortcut to manage it.';
  if (left) left.disabled = !selected || index <= 0 || !canEdit();
  if (right) right.disabled = !selected || index < 0 || index >= shortcuts.length - 1 || !canEdit();
  if (remove) remove.disabled = !selected || !canEdit();
}

function selectWithOptions(values, selected, labeler = (value) => value) {
  const select = element('select', 'manager-select');
  for (const value of values) {
    const option = element('option', '', labeler(value));
    option.value = value;
    option.selected = value === selected;
    select.append(option);
  }
  return select;
}

function rawDraft(entry) {
  const key = `${entry.ruleset}:${entry.spellId}`;
  if (!rawDrafts.has(key)) {
    rawDrafts.set(key, {
      variantId: entry.shortcut.variants[0].id,
      icon: entry.shortcut.icon,
      toHit: 0,
    });
  }
  return rawDrafts.get(key);
}

function variantSummary(entry, variant) {
  const parts = [];
  for (const group of variant.groups) {
    const dice = group.terms.map((term) => `${term.count}d${term.sides}`).join(' + ');
    const mod = group.modifier ? `${group.modifier > 0 ? '+' : '−'}${Math.abs(group.modifier)}` : '';
    const type = group.damageType ? ` ${group.damageType}` : '';
    const repeat = group.repeat > 1 ? ` ×${group.repeat}` : '';
    parts.push(`${group.label}: ${dice}${mod ? ` ${mod}` : ''}${type}${repeat}`);
  }
  return `${entry.spellLevel === 0 ? 'Cantrip' : `Level ${entry.spellLevel}`} • ${parts.join(' • ')}`;
}

function renderRawCatalog(ruleset, query = '') {
  const year = ruleset.endsWith('2024') ? '2024' : '2014';
  const host = document.getElementById(`raw-list-${year}`);
  if (!host) return;
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const entries = getRawCatalog(ruleset).filter((entry) => (
    !normalizedQuery || entry.shortcut.name.toLowerCase().includes(normalizedQuery)
  ));

  host.replaceChildren();
  for (const entry of entries) {
    const draft = rawDraft(entry);
    const card = element('article', 'raw-card');
    const copy = element('div');
    const title = element('div', 'raw-card-title');
    title.append(
      element('span', '', getShortcutIconGlyph(draft.icon)),
      element('strong', '', entry.shortcut.name),
    );
    const chosenVariant = entry.shortcut.variants.find((variant) => variant.id === draft.variantId)
      || entry.shortcut.variants[0];
    copy.append(title, element('p', 'manager-note', variantSummary(entry, chosenVariant)));

    const controls = element('div', 'raw-card-controls');
    const variantLabel = element('label', 'raw-control-label', 'Starting tier');
    const variantSelect = selectWithOptions(
      entry.shortcut.variants.map((variant) => variant.id),
      draft.variantId,
      (id) => entry.shortcut.variants.find((variant) => variant.id === id)?.label || id,
    );
    variantSelect.addEventListener('change', () => {
      draft.variantId = variantSelect.value;
      renderRawCatalog(ruleset, document.getElementById(`search-${year}`)?.value);
    });
    variantLabel.append(variantSelect);

    const iconLabel = element('label', 'raw-control-label', 'Icon');
    const iconSelect = selectWithOptions(BUILTIN_ICON_IDS, draft.icon, (id) => `${getShortcutIconGlyph(id)} ${id}`);
    iconSelect.addEventListener('change', () => {
      draft.icon = iconSelect.value;
      renderRawCatalog(ruleset, document.getElementById(`search-${year}`)?.value);
    });
    iconLabel.append(iconSelect);
    controls.append(variantLabel, iconLabel);

    if (entry.requiredInputs.includes('toHit')) {
      const hitLabel = element('label', 'raw-control-label', 'To-hit');
      const input = element('input', 'manager-input');
      input.type = 'number';
      input.min = '-100';
      input.max = '100';
      input.step = '1';
      input.value = String(draft.toHit);
      input.addEventListener('input', () => { draft.toHit = input.value; });
      hitLabel.append(input);
      controls.append(hitLabel);
    }

    const add = element('button', 'btn primary', 'Add');
    add.type = 'button';
    add.disabled = !canEdit() || shortcuts.length >= MAX_SHORTCUTS;
    add.addEventListener('click', guard(() => {
      const slot = createRawManagerSlot(shortcuts, entry, draft);
      shortcuts = appendShortcutSlot(shortcuts, slot);
      selectedSlotId = slot.id;
      setDirty();
      renderAll();
      setStatus(`${entry.shortcut.name} added. Save Changes to sync it.`, 'ready');
    }));
    controls.append(add);
    card.append(copy, controls);
    host.append(card);
  }

  if (!entries.length) host.append(element('p', 'manager-note', 'No verified RAW entries match that search.'));
}

function renderTabs() {
  document.querySelectorAll('.manager-tab').forEach((button) => {
    const selected = button.dataset.tab === activeTab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.manager-tab-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.panel !== activeTab);
  });
}

function renderIconAndCategoryOptions() {
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

function renderBuilderGroups() {
  const host = document.getElementById('homebrew-groups');
  if (!host) return;
  host.replaceChildren();
  const attackGroups = builderGroups.filter((group) => group.kind === 'attack');

  builderGroups.forEach((group, index) => {
    const card = element('section', 'homebrew-group-card');
    const fields = element('div', 'group-fields');
    const specs = [
      ['Label', 'text', 'label'],
      ['Kind', 'select', 'kind'],
      ['Dice', 'number', 'count'],
      ['Sides', 'select', 'sides'],
      ['Modifier', 'number', 'modifier'],
      ['Repeat', 'number', 'repeat'],
    ];

    for (const [labelText, type, key] of specs) {
      const label = element('label', '', labelText);
      let control;
      if (key === 'kind') {
        control = selectWithOptions(['attack', 'damage', 'healing', 'save', 'check', 'utility'], group.kind);
      } else if (key === 'sides') {
        control = selectWithOptions(ROLLER_DIE_SIDES.map(String), String(group.sides), (value) => `d${value}`);
      } else {
        control = element('input', 'group-input');
        control.type = type;
        if (type === 'number') control.step = '1';
        control.value = String(group[key]);
      }
      control.classList.add('group-input');
      control.addEventListener('change', () => {
        group[key] = ['count', 'sides', 'modifier', 'repeat'].includes(key) ? Number(control.value) : control.value;
        if (key === 'kind') {
          if (group.kind === 'attack') group.sides = 20;
          if (group.kind === 'damage' && !group.damageType) group.damageType = 'slashing';
          if (group.kind !== 'damage') group.critEligible = false;
          renderBuilderGroups();
        }
        renderHomebrewPreview();
      });
      if (key === 'label') {
        control.addEventListener('input', () => {
          group.label = control.value;
          renderHomebrewPreview();
        });
      }
      label.append(control);
      fields.append(label);
    }
    card.append(fields);

    if (group.kind === 'damage') {
      const damage = element('div', 'group-damage-fields');
      const typeLabel = element('label', '', 'Damage type');
      const typeInput = element('input', 'group-input');
      typeInput.type = 'text';
      typeInput.maxLength = 40;
      typeInput.value = group.damageType;
      typeInput.addEventListener('input', () => {
        group.damageType = typeInput.value;
        renderHomebrewPreview();
      });
      typeLabel.append(typeInput);

      const critLabel = element('label', 'checkbox-control');
      const critInput = element('input');
      critInput.type = 'checkbox';
      critInput.checked = group.critEligible;
      critInput.disabled = attackGroups.length === 0;
      critInput.addEventListener('change', () => {
        group.critEligible = critInput.checked;
        if (group.critEligible && !group.triggerGroupId) group.triggerGroupId = attackGroups[0]?.id || '';
        renderBuilderGroups();
        renderHomebrewPreview();
      });
      critLabel.append(critInput, element('span', '', 'Crit eligible'));

      const triggerLabel = element('label', '', 'Triggered by');
      const trigger = selectWithOptions(
        attackGroups.map((attack) => attack.id),
        group.triggerGroupId,
        (id) => attackGroups.find((attack) => attack.id === id)?.label || id,
      );
      trigger.disabled = !group.critEligible;
      trigger.addEventListener('change', () => {
        group.triggerGroupId = trigger.value;
        renderHomebrewPreview();
      });
      triggerLabel.append(trigger);
      damage.append(typeLabel, critLabel, triggerLabel);
      card.append(damage);
    }

    const actions = element('div', 'group-card-actions');
    const remove = element('button', 'btn danger', 'Remove Group');
    remove.type = 'button';
    remove.disabled = builderGroups.length === 1;
    remove.addEventListener('click', () => {
      builderGroups.splice(index, 1);
      renderBuilderGroups();
      renderHomebrewPreview();
    });
    actions.append(remove);
    card.append(actions);
    host.append(card);

    if (index < builderGroups.length - 1) host.append(element('div', 'and-divider', 'AND'));
  });
}

function homebrewPayload() {
  return {
    name: document.getElementById('homebrew-name')?.value || '',
    icon: document.getElementById('homebrew-icon')?.value || 'dice',
    category: document.getElementById('homebrew-category')?.value || 'custom',
    groups: builderGroups,
  };
}

function renderHomebrewPreview() {
  const host = document.getElementById('homebrew-preview');
  if (!host) return;
  host.replaceChildren();
  try {
    const slot = createFlexManagerSlot([], homebrewPayload());
    const groups = slot.definition.variants[0].groups;
    for (const group of groups) {
      const card = element('div', 'preview-group');
      const dice = group.terms.map((term) => `${term.count}d${term.sides}`).join(' + ');
      const modifier = group.modifier ? ` ${group.modifier > 0 ? '+' : '−'} ${Math.abs(group.modifier)}` : '';
      const type = group.damageType ? ` • ${group.damageType}` : '';
      const repeat = group.repeat > 1 ? ` • repeat ${group.repeat}` : '';
      card.append(
        element('strong', '', group.label.toUpperCase()),
        element('span', 'manager-note', `${dice}${modifier}${type}${repeat}`),
      );
      host.append(card);
    }
  } catch (error) {
    host.append(element('p', 'manager-note', error.message));
  }
}

function renderOptions() {
  const critical = document.getElementById('critical-mode');
  const preferred = document.getElementById('preferred-ruleset');
  const note = document.getElementById('custom-crit-note');
  if (critical) critical.value = options.criticalMode;
  if (preferred) preferred.value = options.preferredRuleset;
  if (note) note.classList.toggle('hidden', options.criticalMode !== 'custom');
}

function renderSaveState() {
  const revision = document.getElementById('workspace-revision');
  if (revision) revision.textContent = `Revision ${serverState?.workspace?.revision ?? 0}`;
  setDirty(dirty);
}

function renderAll() {
  renderTabs();
  renderOrganizer();
  renderIconAndCategoryOptions();
  renderBuilderGroups();
  renderHomebrewPreview();
  renderOptions();
  renderSaveState();
  renderRawCatalog('dnd5e-2024', document.getElementById('search-2024')?.value);
  renderRawCatalog('dnd5e-2014', document.getElementById('search-2014')?.value);
}

async function loadManagerState() {
  demoMode = isDeployPreviewDemo();
  if (demoMode) {
    accountUser = null;
    serverState = {
      workspace: {
        revision: 0,
        shortcuts: demoSlots(),
        options: DEFAULT_SHORTCUT_OPTIONS,
      },
      version: null,
    };
    shortcuts = [...serverState.workspace.shortcuts];
    options = normalizeShortcutOptions(serverState.workspace.options);
    activeTab = '2024';
    dirty = false;
    renderAll();
    setStatus('Deploy Preview demo mode. Changes stay in memory and are never saved.', 'ready');
    return;
  }

  accountUser = await refreshAccountUser({ initial: true });
  if (!accountUser) {
    serverState = null;
    shortcuts = [];
    options = DEFAULT_SHORTCUT_OPTIONS;
    dirty = false;
    renderAll();
    setStatus('Sign in from the roller first to load and save your shortcut toolbar.', 'error');
    return;
  }

  serverState = await loadShortcutWorkspace();
  shortcuts = [...serverState.workspace.shortcuts];
  options = normalizeShortcutOptions(serverState.workspace.options);
  activeTab = options.preferredRuleset === 'dnd5e-2014' ? '2014' : '2024';
  selectedSlotId = null;
  dirty = false;
  renderAll();
  setStatus(`Loaded ${shortcuts.length} saved shortcut${shortcuts.length === 1 ? '' : 's'}.`, 'ready');
}

async function saveManagerState() {
  if (!accountUser || demoMode) return;
  if (!serverState) throw new Error('Load your shortcut workspace before saving.');
  const saved = await saveShortcutWorkspace(shortcuts, serverState.version, options);
  serverState = saved;
  shortcuts = [...saved.workspace.shortcuts];
  options = normalizeShortcutOptions(saved.workspace.options);
  dirty = false;
  renderAll();
  setStatus('Shortcut toolbar saved to your account.', 'ready');
}

function bindStaticEvents() {
  document.querySelectorAll('.manager-tab').forEach((button) => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      renderTabs();
    });
  });

  document.getElementById('search-2024')?.addEventListener('input', (event) => {
    renderRawCatalog('dnd5e-2024', event.target.value);
  });
  document.getElementById('search-2014')?.addEventListener('input', (event) => {
    renderRawCatalog('dnd5e-2014', event.target.value);
  });

  document.getElementById('move-shortcut-left')?.addEventListener('click', guard(() => {
    shortcuts = moveShortcutSlot(shortcuts, selectedSlotId, -1);
    setDirty();
    renderOrganizer();
  }));
  document.getElementById('move-shortcut-right')?.addEventListener('click', guard(() => {
    shortcuts = moveShortcutSlot(shortcuts, selectedSlotId, 1);
    setDirty();
    renderOrganizer();
  }));
  document.getElementById('remove-shortcut')?.addEventListener('click', guard(() => {
    const selected = shortcuts.find((slot) => slot.id === selectedSlotId);
    shortcuts = removeShortcutSlot(shortcuts, selectedSlotId);
    selectedSlotId = null;
    setDirty();
    renderAll();
    setStatus(`${selected ? slotName(selected) : 'Shortcut'} removed. Save Changes to sync it.`);
  }));

  document.getElementById('add-homebrew-group')?.addEventListener('click', () => {
    if (builderGroups.length >= 16) {
      setStatus('Homebrew shortcuts can contain at most 16 roll groups.', 'error');
      return;
    }
    nextGroupNumber += 1;
    builderGroups.push(createBuilderGroup('damage', nextGroupNumber));
    renderBuilderGroups();
    renderHomebrewPreview();
  });

  document.getElementById('homebrew-name')?.addEventListener('input', renderHomebrewPreview);
  document.getElementById('homebrew-icon')?.addEventListener('change', renderHomebrewPreview);
  document.getElementById('homebrew-category')?.addEventListener('change', renderHomebrewPreview);

  document.getElementById('homebrew-form')?.addEventListener('submit', guard((event) => {
    event.preventDefault();
    const slot = createFlexManagerSlot(shortcuts, homebrewPayload());
    shortcuts = appendShortcutSlot(shortcuts, slot);
    selectedSlotId = slot.id;
    document.getElementById('homebrew-name').value = '';
    builderGroups = [createBuilderGroup('damage', 1)];
    nextGroupNumber = 1;
    setDirty();
    renderAll();
    setStatus(`${slot.definition.name} added. Save Changes to sync it.`, 'ready');
  }));

  document.getElementById('critical-mode')?.addEventListener('change', (event) => {
    options = updateManagerOptions(options, { criticalMode: event.target.value });
    setDirty();
    renderOptions();
  });
  document.getElementById('preferred-ruleset')?.addEventListener('change', (event) => {
    options = updateManagerOptions(options, { preferredRuleset: event.target.value });
    setDirty();
    renderOptions();
  });

  document.getElementById('save-workspace')?.addEventListener('click', guard(saveManagerState));
  document.getElementById('reload-workspace')?.addEventListener('click', guard(loadManagerState));

  const back = document.getElementById('back-to-roller');
  if (back && isDeployPreviewDemo()) back.href = '/?shortcutDemo=1';
}

async function boot() {
  try {
    bindStaticEvents();
    renderIconAndCategoryOptions();
    renderBuilderGroups();
    renderHomebrewPreview();
    await loadManagerState();
  } catch (error) {
    console.error('Shortcut manager startup failed:', error);
    if (error instanceof ShortcutPersistenceError && error.code === 'shortcut-version-conflict') {
      setStatus('Shortcut data changed in another session. Reload before saving.', 'error');
      return;
    }
    setStatus(error?.message || 'Shortcut manager failed to start.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
