const VIEW_NAMES = ['edit', 'preview', 'sets', 'community'];
const MOBILE_STYLE_TEXT = `
.studio-mobile-nav,.studio-mobile-status{display:none}
@media(max-width:720px){
  .studio-mobile-nav{position:sticky;top:0;z-index:40;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.35rem;margin:0 0 .55rem;padding:.45rem;border:1px solid #334155;border-radius:14px;background:rgba(9,12,18,.96);box-shadow:0 12px 28px rgba(0,0,0,.35);backdrop-filter:blur(14px)}
  .studio-mobile-nav-btn{min-width:0;min-height:44px;padding:.5rem .2rem;border:1px solid #475569;border-radius:10px;background:#182130;color:#e2e8f0;font:inherit;font-size:.76rem;font-weight:900;cursor:pointer;touch-action:manipulation}
  .studio-mobile-nav-btn.active{border-color:#4ade80;background:#14532d;color:#fff;box-shadow:inset 0 0 0 1px rgba(74,222,128,.32)}
  .studio-mobile-nav-btn:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}
  .studio-mobile-status{display:block;min-height:1.15rem;margin:0 0 .55rem;padding:0 .2rem}
  .studio-grid>.library-panel,.studio-grid>.studio-preview-panel,.studio-grid>.editor-panel{display:none}
  body[data-studio-mobile-view="edit"] .studio-grid>.editor-panel,body[data-studio-mobile-view="preview"] .studio-grid>.studio-preview-panel,body[data-studio-mobile-view="sets"] .studio-grid>.library-panel,body[data-studio-mobile-view="community"] .studio-grid>.library-panel{display:block}
  body[data-studio-mobile-view="sets"] .library-panel [data-studio-mobile-group="community"],body[data-studio-mobile-view="community"] .library-panel [data-studio-mobile-group="sets"]{display:none!important}
  body[data-studio-mobile-view] #studio-status{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
}
@media(max-width:380px){.studio-mobile-nav{gap:.25rem;padding:.35rem}.studio-mobile-nav-btn{font-size:.7rem;padding:.42rem .08rem}}
@media(prefers-reduced-motion:reduce){.studio-mobile-nav-btn{transition:none!important}}
`;

function ensureMobileStyles(documentRef) {
  if (documentRef.getElementById('studio-mobile-styles')) return;
  const style = documentRef.createElement('style');
  style.id = 'studio-mobile-styles';
  style.textContent = MOBILE_STYLE_TEXT;
  documentRef.head.appendChild(style);
}

function markMobileGroup(element, group) {
  if (element) element.dataset.studioMobileGroup = group;
}

function syncMobileStatus(source, target) {
  if (!source || !target) return;
  target.textContent = source.textContent || '';
  const kind = source.dataset.kind || '';
  if (kind) target.dataset.kind = kind;
  else delete target.dataset.kind;
}

export function bindStudioMobileNavigation({ documentRef = document, windowRef = window } = {}) {
  try {
    ensureMobileStyles(documentRef);
    const body = documentRef.body;
    const header = documentRef.querySelector('.studio-header');
    const libraryPanel = documentRef.querySelector('.library-panel');
    const previewPanel = documentRef.querySelector('.studio-preview-panel');
    const editorPanel = documentRef.querySelector('.editor-panel');
    if (!body || !header || !libraryPanel || !previewPanel || !editorPanel) return null;

    let nav = documentRef.querySelector('.studio-mobile-nav');
    if (!nav) {
      nav = documentRef.createElement('nav');
      nav.className = 'studio-mobile-nav';
      nav.setAttribute('aria-label', 'Dice Studio sections');
      VIEW_NAMES.forEach((view) => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'studio-mobile-nav-btn';
        button.dataset.studioMobileTarget = view;
        button.textContent = view === 'edit' ? 'Edit' : view === 'preview' ? 'Preview' : view === 'sets' ? 'Sets' : 'Community';
        button.setAttribute('aria-pressed', String(view === 'edit'));
        nav.appendChild(button);
      });
      header.insertAdjacentElement('afterend', nav);
    }

    const sourceStatus = documentRef.getElementById('studio-status');
    let mobileStatus = documentRef.querySelector('.studio-mobile-status');
    if (!mobileStatus) {
      mobileStatus = documentRef.createElement('p');
      mobileStatus.className = 'status-line studio-mobile-status';
      mobileStatus.setAttribute('role', 'status');
      mobileStatus.setAttribute('aria-live', 'polite');
      nav.insertAdjacentElement('afterend', mobileStatus);
    }
    syncMobileStatus(sourceStatus, mobileStatus);
    if (sourceStatus && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => syncMobileStatus(sourceStatus, mobileStatus));
      observer.observe(sourceStatus, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-kind'] });
    }

    const collectionHeading = libraryPanel.querySelector(':scope > .studio-panel-heading:not(.community-heading)');
    const resetDefault = documentRef.getElementById('reset-default');
    [collectionHeading, documentRef.getElementById('storage-mode'), documentRef.getElementById('import-browser-sets'), documentRef.getElementById('studio-library'), resetDefault, resetDefault?.nextElementSibling]
      .forEach((element) => markMobileGroup(element, 'sets'));
    [libraryPanel.querySelector('.community-heading'), libraryPanel.querySelector('.community-rules'), documentRef.getElementById('community-library'), documentRef.getElementById('load-more-community')]
      .forEach((element) => markMobileGroup(element, 'community'));

    function show(view) {
      const next = VIEW_NAMES.includes(view) ? view : 'edit';
      body.dataset.studioMobileView = next;
      nav.querySelectorAll('[data-studio-mobile-target]').forEach((button) => {
        const selected = button.dataset.studioMobileTarget === next;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      return next;
    }

    nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-studio-mobile-target]');
      if (button) show(button.dataset.studioMobileTarget);
    });

    documentRef.addEventListener('click', (event) => {
      if (event.target.closest('#new-set')) {
        windowRef.queueMicrotask(() => show('edit'));
        return;
      }
      if (event.target.closest('#studio-library .studio-set-card')) {
        windowRef.queueMicrotask(() => show('edit'));
        return;
      }
      if (event.target.closest('#community-library .studio-set-card')) {
        windowRef.queueMicrotask(() => show('preview'));
        return;
      }
      if (event.target.closest('[data-preview-face]')) windowRef.queueMicrotask(() => show('edit'));
    });

    show(body.dataset.studioMobileView || 'edit');
    return { show, current: () => body.dataset.studioMobileView || 'edit' };
  } catch (error) {
    console.error('Failed to bind Dice Studio mobile navigation:', error);
    return null;
  }
}
