import { ShortcutPersistenceError } from './shortcuts/persistence-client.mjs';
import { managerContext, isDeployPreviewDemo } from './shortcuts/manager-context.mjs';
import { updateManagerOptions } from './shortcuts/manager-state.mjs';
import { bindOrganizerEvents, renderOrganizer } from './shortcuts/manager-organizer.mjs';
import { bindRawSearch, renderRawCatalog } from './shortcuts/manager-raw.mjs';
import { bindHomebrewEvents, renderHomebrew } from './shortcuts/manager-homebrew.mjs';
import { loadManagerState, saveManagerState } from './shortcuts/manager-session.mjs';
import {
  guard, markDirty, renderIconAndCategoryOptions, renderOptions, renderSaveState,
  renderTabs, setStatus,
} from './shortcuts/manager-ui.mjs';

function renderAll() {
  renderTabs();
  renderOrganizer();
  renderIconAndCategoryOptions();
  renderHomebrew();
  renderOptions();
  renderSaveState();
  renderRawCatalog('dnd5e-2024', document.getElementById('search-2024')?.value, renderAll);
  renderRawCatalog('dnd5e-2014', document.getElementById('search-2014')?.value, renderAll);
}

function bindTabsAndOptions() {
  document.querySelectorAll('.manager-tab').forEach((button) => {
    button.addEventListener('click', () => {
      managerContext.activeTab = button.dataset.tab;
      renderTabs();
    });
  });
  document.getElementById('critical-mode')?.addEventListener('change', (event) => {
    try {
      managerContext.options = updateManagerOptions(managerContext.options, { criticalMode: event.target.value });
      markDirty();
      renderOptions();
    } catch (error) {
      console.error('Failed to update critical mode:', error);
      setStatus(error.message || 'Unable to update critical mode.', 'error');
    }
  });
  document.getElementById('preferred-ruleset')?.addEventListener('change', (event) => {
    try {
      managerContext.options = updateManagerOptions(managerContext.options, { preferredRuleset: event.target.value });
      markDirty();
      renderOptions();
    } catch (error) {
      console.error('Failed to update preferred ruleset:', error);
      setStatus(error.message || 'Unable to update ruleset preference.', 'error');
    }
  });
}

function bindPersistence() {
  document.getElementById('save-workspace')?.addEventListener('click', guard(() => saveManagerState(renderAll)));
  document.getElementById('reload-workspace')?.addEventListener('click', guard(() => loadManagerState(renderAll)));
  const back = document.getElementById('back-to-roller');
  if (back && isDeployPreviewDemo()) back.href = '/?shortcutDemo=1';
}

function bindEvents() {
  bindTabsAndOptions();
  bindRawSearch(renderAll);
  bindOrganizerEvents(renderAll);
  bindHomebrewEvents(renderAll);
  bindPersistence();
}

async function boot() {
  try {
    bindEvents();
    renderIconAndCategoryOptions();
    renderHomebrew();
    await loadManagerState(renderAll);
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
