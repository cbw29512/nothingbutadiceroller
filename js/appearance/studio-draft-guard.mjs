export function createStudioDraftGuard({ confirmFn = globalThis.confirm } = {}) {
  let dirty = false;

  function isDirty() { return dirty; }
  function markDirty() { dirty = true; return dirty; }
  function markClean() { dirty = false; return dirty; }
  function confirmAction(message) {
    try {
      return typeof confirmFn === 'function' ? Boolean(confirmFn(message)) : false;
    } catch (error) {
      console.error('Studio confirmation failed:', error);
      return false;
    }
  }
  function confirmDiscard(message = 'Discard unsaved changes to this dice set?') {
    return !dirty || confirmAction(message);
  }
  function bindBeforeUnload(target = globalThis) {
    try {
      if (typeof target?.addEventListener !== 'function') return;
      target.addEventListener('beforeunload', (event) => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = '';
      });
    } catch (error) {
      console.error('Failed to bind Studio unsaved-change protection:', error);
    }
  }

  return Object.freeze({ isDirty, markDirty, markClean, confirmAction, confirmDiscard, bindBeforeUnload });
}
