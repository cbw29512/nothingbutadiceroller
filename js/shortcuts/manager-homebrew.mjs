import { appendShortcutSlot } from './manager-state.mjs';
import { createFlexManagerSlot } from './manager-flex-state.mjs';
import { createBuilderGroup, managerContext, resetBuilder } from './manager-context.mjs';
import { element, guard, markDirty, setStatus } from './manager-ui.mjs';
import { homebrewPayload, renderBuilderGroups } from './manager-homebrew-fields.mjs';

export function renderHomebrewPreview() {
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

export function renderHomebrew() {
  renderBuilderGroups(renderHomebrewPreview);
  renderHomebrewPreview();
}

export function bindHomebrewEvents(onChanged) {
  document.getElementById('add-homebrew-group')?.addEventListener('click', () => {
    try {
      if (managerContext.builderGroups.length >= 16) {
        throw new Error('Homebrew shortcuts can contain at most 16 roll groups.');
      }
      managerContext.nextGroupNumber += 1;
      managerContext.builderGroups.push(createBuilderGroup('damage', managerContext.nextGroupNumber));
      renderHomebrew();
    } catch (error) {
      console.error('Failed to add Homebrew group:', error);
      setStatus(error.message || 'Unable to add roll group.', 'error');
    }
  });

  document.getElementById('homebrew-name')?.addEventListener('input', renderHomebrewPreview);
  document.getElementById('homebrew-icon')?.addEventListener('change', renderHomebrewPreview);
  document.getElementById('homebrew-category')?.addEventListener('change', renderHomebrewPreview);

  document.getElementById('homebrew-form')?.addEventListener('submit', guard((event) => {
    event.preventDefault();
    const slot = createFlexManagerSlot(managerContext.shortcuts, homebrewPayload());
    managerContext.shortcuts = appendShortcutSlot(managerContext.shortcuts, slot);
    managerContext.selectedSlotId = slot.id;
    const name = slot.definition.name;
    const nameInput = document.getElementById('homebrew-name');
    if (nameInput) nameInput.value = '';
    resetBuilder();
    markDirty();
    onChanged();
    setStatus(`${name} added. Save Changes to sync it.`, 'ready');
  }));
}
