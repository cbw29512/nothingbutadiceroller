import { bindFaceSymbolPicker } from './face-symbol-picker.mjs';
import { ensureStudioFaceFontControl } from './studio-face-font-controls.mjs';
import { bindStudioInlayControls, ensureStudioInlayControls } from './studio-inlay-controls.mjs';
import { bindStudioPatternControls } from './studio-pattern-controls.mjs';
import { bindStudioResinControls } from './studio-resin-controls.mjs';
import { bindStudioSurfaceControls } from './studio-surface-controls.mjs';
import { bindStudioVisualControls } from './studio-visual-controls.mjs';

export function bindStudioControls(context) {
  const {
    q, actions, draft, dice, ownerId, refresh, setStatus, draftGuard,
    documentRef = document, windowRef = window,
  } = context;
  try {
    ensureStudioInlayControls(documentRef);
    ensureStudioFaceFontControl(documentRef);
    q('new-set').addEventListener('click', actions.newSet); q('save-set').addEventListener('click', actions.saveDraft);
    q('lock-set').addEventListener('click', actions.toggleLock); q('publish-set').addEventListener('click', actions.togglePublish);
    const useButton = q('use-set');
    useButton.textContent = 'Use This Set & Back to Roller';
    const backLink = documentRef.querySelector('.studio-header a[href="/"]');
    if (backLink) backLink.textContent = 'Back to Roller (Keep Current Set)';
    q('use-set').addEventListener('click', actions.activateDraft);
    useButton.addEventListener('click', () => {
      if (q('active-badge')?.textContent === 'ACTIVE') {
        windowRef.setTimeout(() => windowRef.location.assign('/'), 600);
      }
    });
    q('delete-set').addEventListener('click', actions.deleteDraft);
    q('import-browser-sets').addEventListener('click', actions.importBrowserCollection);
    q('refresh-community').addEventListener('click', actions.reloadCommunity);
    q('load-more-community').addEventListener('click', actions.loadMoreCommunity);
    q('reset-default').addEventListener('click', actions.resetDefault);
    q('set-name').addEventListener('input', () => { if (draft.canEdit()) draft.markDirty(); });
    q('set-name').addEventListener('change', () => draft.update((set) => { set.name = q('set-name').value.trim() || 'Untitled Dice Set'; }));
    documentRef.addEventListener('click', (event) => {
      const previewFace = event.target.closest('[data-preview-face]');
      if (previewFace) {
        const type = previewFace.closest('[data-die]')?.dataset.die;
        const logicalFace = previewFace.dataset.previewFace;
        if (type && logicalFace) {
          const startedFromDefault = draft.get()?.systemOwned === true;
          if (startedFromDefault) {
            actions.newSet();
            if (draft.get()?.systemOwned === true) {
              setStatus('Unable to create an editable copy of Default Dice. Reload and try again.', 'error');
              return;
            }
          }
          q('logical-face').value = logicalFace;
          dice.select(type);
          const editor = q('face-value');
          if (editor && !editor.disabled) {
            editor.focus(); editor.select();
            setStatus(startedFromDefault
              ? `Editable copy created. Face ${logicalFace} is ready to customize; it will always roll ${logicalFace}.`
              : `Face ${logicalFace} selected. Edit its display, color, or font below; it will always roll ${logicalFace}.`, 'ready');
          } else {
            setStatus('This dice set is locked or read-only. Unlock or copy it before customizing this face.', 'ready');
          }
        }
        return;
      }
      const type = event.target.closest('[data-die]')?.dataset.die;
      if (type) dice.select(type);
    });
    bindFaceSymbolPicker({ q, setStatus, documentRef });
    bindStudioVisualControls({
      q, updateDraft: draft.update, getDraft: draft.get, setDraft: draft.set,
      getSelectedDie: dice.get, getOwnerId: ownerId, refresh, setStatus,
    });
    bindStudioResinControls({
      q, updateDraft: draft.update, getSelectedDie: dice.get, refresh, setStatus,
    });
    bindStudioSurfaceControls({
      q, updateDraft: draft.update, getSelectedDie: dice.get, refresh, setStatus,
    });
    bindStudioPatternControls({
      q, updateDraft: draft.update, getSelectedDie: dice.get, refresh, setStatus,
    });
    bindStudioInlayControls({
      q, updateDraft: draft.update, getSelectedDie: dice.get, refresh, setStatus,
    });
    draftGuard.bindBeforeUnload(windowRef);
  } catch (error) {
    console.error('Failed to bind Dice Studio controls:', error);
    throw error;
  }
}
