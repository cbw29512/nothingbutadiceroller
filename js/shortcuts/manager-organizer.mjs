import { MAX_SHORTCUTS } from './constants.mjs';
import { managerContext, canEdit, slotName } from './manager-context.mjs';
import { markDirty, setStatus } from './manager-ui.mjs';
import { duplicateFlexShortcutSlot, moveShortcutSlot, removeShortcutSlot } from './manager-state.mjs';
import { renderShortcutToolbar } from './toolbar.mjs';

export function renderOrganizer() {
  const toolbar = document.getElementById('manager-toolbar');
  const empty = document.getElementById('empty-toolbar-note');
  const count = document.getElementById('shortcut-count');
  if (!toolbar || !empty || !count) return;

  count.textContent = `${managerContext.shortcuts.length} / ${MAX_SHORTCUTS}`;
  empty.hidden = managerContext.shortcuts.length > 0;
  renderShortcutToolbar(toolbar, managerContext.shortcuts.map((slot) => ({
    id: slot.id,
    name: slotName(slot),
    icon: slot.icon,
  })), {
    onActivate: (item) => {
      managerContext.selectedSlotId = item.id;
      renderOrganizer();
    },
    onInfo: (item) => setStatus(`${item.name} selected for toolbar management.`),
    onInfoHide: () => {},
    toolbarLabel: 'Toolbar organizer',
  });

  const selectedId = managerContext.selectedSlotId;
  if (selectedId && !managerContext.shortcuts.some((slot) => slot.id === selectedId)) {
    managerContext.selectedSlotId = null;
  }
  toolbar.querySelector(`[data-shortcut-id="${CSS.escape(managerContext.selectedSlotId || '')}"]`)?.classList.add('manager-selected');

  const selected = managerContext.shortcuts.find((slot) => slot.id === managerContext.selectedSlotId);
  const index = selected ? managerContext.shortcuts.findIndex((slot) => slot.id === selected.id) : -1;
  const name = document.getElementById('selected-shortcut-name');
  const left = document.getElementById('move-shortcut-left');
  const right = document.getElementById('move-shortcut-right');
  const remove = document.getElementById('remove-shortcut');
  const duplicate = document.getElementById('duplicate-shortcut');
  if (name) name.textContent = selected
    ? `${selected.source === 'flex' ? 'CUSTOM' : selected.ruleset.endsWith('2014') ? 'RAW 2014' : 'RAW 2024'} • ${slotName(selected)}`
    : 'Select a shortcut to manage it.';
  if (left) left.disabled = !selected || index <= 0 || !canEdit();
  if (right) right.disabled = !selected || index < 0 || index >= managerContext.shortcuts.length - 1 || !canEdit();
  if (remove) remove.disabled = !selected || !canEdit();
  if (duplicate) duplicate.disabled = !selected || selected.source !== 'flex' || !canEdit();
}

export function bindOrganizerEvents(onChanged) {
  document.getElementById('move-shortcut-left')?.addEventListener('click', () => {
    try {
      managerContext.shortcuts = moveShortcutSlot(managerContext.shortcuts, managerContext.selectedSlotId, -1);
      markDirty();
      renderOrganizer();
    } catch (error) {
      console.error('Failed to move shortcut left:', error);
      setStatus(error.message || 'Unable to move shortcut.', 'error');
    }
  });
  document.getElementById('move-shortcut-right')?.addEventListener('click', () => {
    try {
      managerContext.shortcuts = moveShortcutSlot(managerContext.shortcuts, managerContext.selectedSlotId, 1);
      markDirty();
      renderOrganizer();
    } catch (error) {
      console.error('Failed to move shortcut right:', error);
      setStatus(error.message || 'Unable to move shortcut.', 'error');
    }
  });
  document.getElementById('remove-shortcut')?.addEventListener('click', () => {
    try {
      const selected = managerContext.shortcuts.find((slot) => slot.id === managerContext.selectedSlotId);
      managerContext.shortcuts = removeShortcutSlot(managerContext.shortcuts, managerContext.selectedSlotId);
      managerContext.selectedSlotId = null;
      markDirty();
      onChanged();
      setStatus(`${selected ? slotName(selected) : 'Shortcut'} removed. Save Changes to keep it.`);
    } catch (error) {
      console.error('Failed to remove shortcut:', error);
      setStatus(error.message || 'Unable to remove shortcut.', 'error');
    }
  });
  document.getElementById('duplicate-shortcut')?.addEventListener('click', () => {
    try {
      const before = managerContext.shortcuts.length;
      managerContext.shortcuts = duplicateFlexShortcutSlot(managerContext.shortcuts, managerContext.selectedSlotId);
      const copy = managerContext.shortcuts[before];
      managerContext.selectedSlotId = copy.id;
      markDirty();
      onChanged();
      setStatus(`${slotName(copy)} duplicated. Save Changes to keep it.`, 'ready');
    } catch (error) {
      console.error('Failed to duplicate shortcut:', error);
      setStatus(error.message || 'Unable to duplicate shortcut.', 'error');
    }
  });
}

