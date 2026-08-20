import { BUILTIN_ICON_IDS, MAX_SHORTCUTS } from './constants.mjs';
import { canEdit, managerContext } from './manager-context.mjs';
import { getShortcutIconGlyph } from './icons.mjs';
import { appendShortcutSlot, createRawManagerSlot } from './manager-state.mjs';
import { getRawCatalog } from './raw/index.mjs';
import { element, guard, markDirty, selectWithOptions, setStatus } from './manager-ui.mjs';

function rawDraft(entry) {
  const key = `${entry.ruleset}:${entry.spellId}`;
  if (!managerContext.rawDrafts.has(key)) {
    managerContext.rawDrafts.set(key, {
      variantId: entry.shortcut.variants[0].id,
      icon: entry.shortcut.icon,
      toHit: 0,
    });
  }
  return managerContext.rawDrafts.get(key);
}

function variantSummary(entry, variant) {
  const parts = variant.groups.map((group) => {
    const dice = group.terms.map((term) => `${term.count}d${term.sides}`).join(' + ');
    const mod = group.modifier ? `${group.modifier > 0 ? '+' : '−'}${Math.abs(group.modifier)}` : '';
    const type = group.damageType ? ` ${group.damageType}` : '';
    const repeat = group.repeat > 1 ? ` ×${group.repeat}` : '';
    return `${group.label}: ${dice}${mod ? ` ${mod}` : ''}${type}${repeat}`;
  });
  return `${entry.spellLevel === 0 ? 'Cantrip' : `Level ${entry.spellLevel}`} • ${parts.join(' • ')}`;
}

function buildRawControls(entry, draft, ruleset, year, onChanged) {
  const controls = element('div', 'raw-card-controls');
  const variantLabel = element('label', 'raw-control-label', 'Starting tier');
  const variantSelect = selectWithOptions(
    entry.shortcut.variants.map((variant) => variant.id),
    draft.variantId,
    (id) => entry.shortcut.variants.find((variant) => variant.id === id)?.label || id,
  );
  variantSelect.addEventListener('change', () => {
    draft.variantId = variantSelect.value;
    renderRawCatalog(ruleset, document.getElementById(`search-${year}`)?.value, onChanged);
  });
  variantLabel.append(variantSelect);

  const iconLabel = element('label', 'raw-control-label', 'Icon');
  const iconSelect = selectWithOptions(BUILTIN_ICON_IDS, draft.icon, (id) => `${getShortcutIconGlyph(id)} ${id}`);
  iconSelect.addEventListener('change', () => {
    draft.icon = iconSelect.value;
    renderRawCatalog(ruleset, document.getElementById(`search-${year}`)?.value, onChanged);
  });
  iconLabel.append(iconSelect);
  controls.append(variantLabel, iconLabel);

  if (entry.requiredInputs.includes('toHit')) {
    const label = element('label', 'raw-control-label', 'To-hit');
    const input = element('input', 'manager-input');
    Object.assign(input, { type: 'number', min: '-100', max: '100', step: '1', value: String(draft.toHit) });
    input.addEventListener('input', () => { draft.toHit = input.value; });
    label.append(input);
    controls.append(label);
  }

  const add = element('button', 'btn primary', 'Add');
  add.type = 'button';
  add.disabled = !canEdit() || managerContext.shortcuts.length >= MAX_SHORTCUTS;
  add.addEventListener('click', guard(() => {
    const slot = createRawManagerSlot(managerContext.shortcuts, entry, draft);
    managerContext.shortcuts = appendShortcutSlot(managerContext.shortcuts, slot);
    managerContext.selectedSlotId = slot.id;
    markDirty();
    onChanged();
    setStatus(`${entry.shortcut.name} added. Save Changes to sync it.`, 'ready');
  }));
  controls.append(add);
  return controls;
}

export function renderRawCatalog(ruleset, query = '', onChanged = () => {}) {
  const year = ruleset.endsWith('2024') ? '2024' : '2014';
  const host = document.getElementById(`raw-list-${year}`);
  if (!host) return;
  const search = String(query || '').trim().toLowerCase();
  const entries = getRawCatalog(ruleset).filter((entry) => !search || entry.shortcut.name.toLowerCase().includes(search));
  host.replaceChildren();

  for (const entry of entries) {
    const draft = rawDraft(entry);
    const card = element('article', 'raw-card');
    const copy = element('div');
    const title = element('div', 'raw-card-title');
    title.append(element('span', '', getShortcutIconGlyph(draft.icon)), element('strong', '', entry.shortcut.name));
    const chosen = entry.shortcut.variants.find((variant) => variant.id === draft.variantId) || entry.shortcut.variants[0];
    copy.append(title, element('p', 'manager-note', variantSummary(entry, chosen)));
    card.append(copy, buildRawControls(entry, draft, ruleset, year, onChanged));
    host.append(card);
  }
  if (!entries.length) host.append(element('p', 'manager-note', 'No verified RAW entries match that search.'));
}

export function bindRawSearch(onChanged) {
  document.getElementById('search-2024')?.addEventListener('input', (event) => {
    renderRawCatalog('dnd5e-2024', event.target.value, onChanged);
  });
  document.getElementById('search-2014')?.addEventListener('input', (event) => {
    renderRawCatalog('dnd5e-2014', event.target.value, onChanged);
  });
}
