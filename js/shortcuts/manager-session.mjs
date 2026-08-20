import { refreshAccountUser } from '../account-api.js';
import { DEFAULT_SHORTCUT_OPTIONS, normalizeShortcutOptions } from './persistence.mjs';
import { loadShortcutWorkspace, saveShortcutWorkspace } from './persistence-client.mjs';
import {
  applyServerState, demoSlots, isDeployPreviewDemo, managerContext,
} from './manager-context.mjs';
import { setStatus } from './manager-ui.mjs';

export async function loadManagerState(renderAll) {
  managerContext.demoMode = isDeployPreviewDemo();
  if (managerContext.demoMode) {
    managerContext.accountUser = null;
    managerContext.serverState = {
      workspace: { revision: 0, shortcuts: demoSlots(), options: DEFAULT_SHORTCUT_OPTIONS },
      version: null,
    };
    managerContext.shortcuts = [...managerContext.serverState.workspace.shortcuts];
    managerContext.options = normalizeShortcutOptions(managerContext.serverState.workspace.options);
    managerContext.activeTab = '2024';
    managerContext.selectedSlotId = null;
    managerContext.dirty = false;
    renderAll();
    setStatus('Deploy Preview demo mode. Changes stay in memory and are never saved.', 'ready');
    return;
  }

  const user = await refreshAccountUser({ initial: true });
  if (!user) {
    managerContext.accountUser = null;
    managerContext.serverState = null;
    managerContext.shortcuts = [];
    managerContext.options = DEFAULT_SHORTCUT_OPTIONS;
    managerContext.activeTab = '2024';
    managerContext.selectedSlotId = null;
    managerContext.dirty = false;
    renderAll();
    setStatus('Sign in from the roller first to load and save your shortcut toolbar.', 'error');
    return;
  }

  const serverState = await loadShortcutWorkspace();
  applyServerState(serverState, user);
  renderAll();
  setStatus(`Loaded ${managerContext.shortcuts.length} saved shortcut${managerContext.shortcuts.length === 1 ? '' : 's'}.`, 'ready');
}

export async function saveManagerState(renderAll) {
  if (!managerContext.accountUser || managerContext.demoMode) return;
  if (!managerContext.serverState) throw new Error('Load your shortcut workspace before saving.');
  const saved = await saveShortcutWorkspace(
    managerContext.shortcuts,
    managerContext.serverState.version,
    managerContext.options,
  );
  applyServerState(saved, managerContext.accountUser);
  renderAll();
  setStatus('Shortcut toolbar saved to your account.', 'ready');
}
