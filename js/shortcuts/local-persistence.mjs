import {
  createEmptyShortcutWorkspace,
  createStoredShortcutWorkspace,
  validateStoredShortcutWorkspace,
} from './persistence.mjs';

export const LOCAL_SHORTCUT_WORKSPACE_KEY = 'nothingbutadiceroller.shortcuts.v2';

function storage() {
  const value = globalThis.localStorage;
  if (!value) throw new Error('Local shortcut storage is unavailable in this browser.');
  return value;
}

export function loadLocalShortcutWorkspace() {
  const raw = storage().getItem(LOCAL_SHORTCUT_WORKSPACE_KEY);
  if (!raw) return { workspace: createEmptyShortcutWorkspace(), version: null };
  try {
    const workspace = validateStoredShortcutWorkspace(JSON.parse(raw));
    return { workspace, version: String(workspace.revision) };
  } catch (error) {
    throw new Error('Local shortcuts could not be read safely. Clear this site’s browser data to reset them.', { cause: error });
  }
}

export function saveLocalShortcutWorkspace(shortcuts, options) {
  const current = loadLocalShortcutWorkspace().workspace;
  const workspace = createStoredShortcutWorkspace(shortcuts, {
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
    options,
  });
  storage().setItem(LOCAL_SHORTCUT_WORKSPACE_KEY, JSON.stringify(workspace));
  return { workspace, version: String(workspace.revision) };
}
