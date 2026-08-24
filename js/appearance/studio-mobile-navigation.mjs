const VIEW_NAMES = ['edit', 'preview', 'sets', 'community'];

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
