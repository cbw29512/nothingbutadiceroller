export function bindStudioActionWorkflow({ documentRef = document, windowRef = window, draftGuard } = {}) {
  try {
    const original = documentRef.querySelector('.editor-panel > .studio-actions');
    if (!original || !draftGuard?.isDirty) return null;
    documentRef.documentElement.classList.add('studio-action-workflow-active');

    const save = documentRef.getElementById('save-set');
    const use = documentRef.getElementById('use-set');
    const lock = documentRef.getElementById('lock-set');
    const publish = documentRef.getElementById('publish-set');
    const remove = documentRef.getElementById('delete-set');
    if (![save, use, lock, publish, remove].every(Boolean)) return null;

    const secondary = documentRef.createElement('details');
    secondary.className = 'studio-secondary-actions';
    const secondarySummary = documentRef.createElement('summary');
    secondarySummary.textContent = 'More set actions';
    const secondaryContent = documentRef.createElement('div');
    secondaryContent.className = 'studio-secondary-actions-content';
    secondaryContent.append(lock, publish, remove);
    secondary.append(secondarySummary, secondaryContent);

    const primary = documentRef.createElement('div');
    primary.className = 'studio-primary-action-bar';
    primary.setAttribute('aria-label', 'Save and use dice set');
    const state = documentRef.createElement('span');
    state.className = 'studio-primary-action-state';
    state.innerHTML = '<strong></strong><small></small>';
    save.textContent = 'Save Set';
    use.textContent = 'Use & Back to Roller';
    primary.append(state, save, use);
    original.replaceWith(secondary, primary);

    function sync() {
      const dirty = Boolean(draftGuard.isDirty());
      state.dataset.dirty = String(dirty);
      state.querySelector('strong').textContent = dirty ? 'Unsaved changes' : 'Saved';
      state.querySelector('small').textContent = dirty ? 'Save before using, locking, or publishing.' : 'This draft matches its saved state.';
      primary.classList.toggle('is-dirty', dirty);
      return dirty;
    }

    for (const eventName of ['input', 'change', 'click']) {
      documentRef.addEventListener(eventName, () => windowRef.queueMicrotask(sync));
    }
    const status = documentRef.getElementById('studio-status');
    if (status && typeof windowRef.MutationObserver === 'function') {
      const observer = new windowRef.MutationObserver(sync);
      observer.observe(status, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-kind'] });
    }
    sync();

    return { sync, primary, secondary };
  } catch (error) {
    console.error('Failed to create Dice Studio Save/Use workflow:', error);
    return null;
  }
}
