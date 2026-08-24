const STYLE_TEXT = `
html.studio-action-workflow-active{scroll-padding-bottom:8rem}
.studio-secondary-actions{margin-top:.75rem;border:1px solid #334155;border-radius:12px;background:#0b1018;overflow:clip}
.studio-secondary-actions>summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.65rem .75rem;cursor:pointer;list-style:none;color:#cbd5e1;font-size:.78rem;font-weight:900}
.studio-secondary-actions>summary::-webkit-details-marker{display:none}
.studio-secondary-actions>summary::after{content:'+';font-size:1rem;color:#93c5fd}
.studio-secondary-actions[open]>summary::after{content:'−'}
.studio-secondary-actions>summary:focus-visible{outline:3px solid #38bdf8;outline-offset:-3px}
.studio-secondary-actions-content{display:flex;flex-wrap:wrap;gap:.5rem;padding:.7rem;border-top:1px solid #273449}
.studio-secondary-actions-content .btn{flex:1 1 120px}
.studio-primary-action-bar{position:sticky;bottom:.5rem;z-index:30;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:.5rem;align-items:center;margin-top:.7rem;padding:.65rem;border:1px solid #64748b;border-radius:14px;background:rgba(15,23,42,.96);box-shadow:0 16px 38px rgba(0,0,0,.5);backdrop-filter:blur(14px)}
.studio-primary-action-state{min-width:0;display:grid;gap:.08rem;color:#dbeafe}
.studio-primary-action-state strong{font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.studio-primary-action-state small{font-size:.68rem;color:#94a3b8}
.studio-primary-action-state[data-dirty="true"] strong{color:#fde68a}
.studio-primary-action-bar .btn{min-height:44px;white-space:nowrap}
@media(max-width:720px){
  html.studio-action-workflow-active{scroll-padding-bottom:10rem}
  .studio-primary-action-bar{bottom:calc(.45rem + env(safe-area-inset-bottom));grid-template-columns:1fr 1fr;margin-left:-.2rem;margin-right:-.2rem;padding:.55rem}
  .studio-primary-action-state{grid-column:1/-1;grid-template-columns:auto 1fr;align-items:baseline;gap:.45rem}
  .studio-primary-action-state small{text-align:right}
  .studio-primary-action-bar .btn{width:100%;padding:.55rem .45rem}
}
@media(max-width:380px){.studio-primary-action-bar .btn{font-size:.76rem}.studio-primary-action-state strong{font-size:.74rem}}
@media(prefers-reduced-motion:reduce){.studio-primary-action-bar,.studio-secondary-actions{scroll-behavior:auto}}
`;

function ensureStyles(documentRef) {
  if (documentRef.getElementById('studio-action-workflow-styles')) return;
  const style = documentRef.createElement('style');
  style.id = 'studio-action-workflow-styles';
  style.textContent = STYLE_TEXT;
  documentRef.head.appendChild(style);
  documentRef.documentElement.classList.add('studio-action-workflow-active');
}

export function bindStudioActionWorkflow({ documentRef = document, windowRef = window, draftGuard } = {}) {
  try {
    const original = documentRef.querySelector('.editor-panel > .studio-actions');
    if (!original || !draftGuard?.isDirty) return null;
    ensureStyles(documentRef);

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
