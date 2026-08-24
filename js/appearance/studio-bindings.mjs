import { bindFaceSymbolPicker } from './face-symbol-picker.mjs';
import { bindStudioActionWorkflow, STUDIO_USE_ACTION_LABEL } from './studio-action-workflow.mjs';
import { ensureStudioFaceFontControl } from './studio-face-font-controls.mjs';
import { ensureStudioFacePositionControl } from './studio-face-position-controls.mjs';
import { ensureStudioFaceScaleControl } from './studio-face-scale-controls.mjs';
import { bindStudioFaceStyleBatchControl, ensureStudioFaceStyleBatchControl } from './studio-face-style-batch-controls.mjs';
import { bindStudioInlayControls, ensureStudioInlayControls } from './studio-inlay-controls.mjs';
import { bindStudioMobileNavigation } from './studio-mobile-navigation.mjs';
import { bindStudioPatternControls } from './studio-pattern-controls.mjs';
import { bindStudioPreviewGeometry } from './studio-preview-geometry.mjs';
import { bindStudioProgressiveSections } from './studio-progressive-sections.mjs';
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
    ensureStudioFaceScaleControl(documentRef);
    ensureStudioFacePositionControl(documentRef);
    ensureStudioFaceStyleBatchControl(documentRef);
    bindStudioMobileNavigation({ documentRef, windowRef });
    bindStudioPreviewGeometry({ documentRef, windowRef });
    const progressiveSections = bindStudioProgressiveSections({ documentRef });
    q('new-set').addEventListener('click', actions.newSet); q('save-set').addEventListener('click', actions.saveDraft);
    q('lock-set').addEventListener('click', actions.toggleLock); q('publish-set').addEventListener('click', actions.togglePublish);
    const useButton = q('use-set');
    useButton.textContent = STUDIO_USE_ACTION_LABEL;
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
    bindStudioActionWorkflow({ documentRef, windowRef, draftGuard });
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
          progressiveSections?.open('faces');
          const editor = q('face-value');
          if (editor && !editor.disabled) {
            editor.focus(); editor.select();
            setStatus(startedFromDefault
              ? `Editable copy created. Face ${logicalFace} is ready to customize; it will always roll ${logicalFace}.`
              : `Face ${logicalFace} selected. Edit its display, color, font, size, or position below; it will always roll ${logicalFace}.`, 'ready');
          } else {
            setStatus('This dice set is locked or read-only. Unlock or copy it before customizing this face.', 'ready');
          }
        }
        return;
      }
      const type = event.target.closest('[data-die]')?.dataset.die;
      if (type) { dice.select(type); progressiveSections?.open('dice'); }
    });
    bindFaceSymbolPicker({ q, setStatus, documentRef });
    bindStudioVisualControls({
      q, updateDraft: draft.update, getDraft: draft.get, setDraft: draft.set,
      getSelectedDie: dice.get, getOwnerId: ownerId, refresh, setStatus,
    });
    bindStudioFaceStyleBatchControl({
      q, getDraft: draft.get, setDraft: draft.set, getSelectedDie: dice.get,
      getOwnerId: ownerId, refresh, setStatus, windowRef,
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
