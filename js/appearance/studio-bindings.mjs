import { bindStudioVisualControls } from './studio-visual-controls.mjs';

export function bindStudioControls(context) {
  const {
    q, actions, draft, dice, ownerId, refresh, setStatus, draftGuard,
    documentRef = document, windowRef = window,
  } = context;
  try {
    q('new-set').addEventListener('click', actions.newSet); q('save-set').addEventListener('click', actions.saveDraft);
    q('lock-set').addEventListener('click', actions.toggleLock); q('publish-set').addEventListener('click', actions.togglePublish);
    q('use-set').addEventListener('click', actions.activateDraft); q('delete-set').addEventListener('click', actions.deleteDraft);
    q('import-browser-sets').addEventListener('click', actions.importBrowserCollection);
    q('refresh-community').addEventListener('click', actions.reloadCommunity); q('reset-default').addEventListener('click', actions.resetDefault);
    q('set-name').addEventListener('input', () => { if (draft.canEdit()) draft.markDirty(); });
    q('set-name').addEventListener('change', () => draft.update((set) => { set.name = q('set-name').value.trim() || 'Untitled Dice Set'; }));
    documentRef.addEventListener('click', (event) => {
      const type = event.target.closest('[data-die]')?.dataset.die;
      if (type) dice.select(type);
    });
    bindStudioVisualControls({
      q, updateDraft: draft.update, getDraft: draft.get, setDraft: draft.set,
      getSelectedDie: dice.get, getOwnerId: ownerId, refresh, setStatus,
    });
    draftGuard.bindBeforeUnload(windowRef);
  } catch (error) {
    console.error('Failed to bind Dice Studio controls:', error);
    throw error;
  }
}
