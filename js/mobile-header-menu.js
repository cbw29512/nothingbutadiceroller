const STYLE_TEXT = `
.mobile-header-more{display:none}
@media(max-width:700px){
  .header-controls{grid-template-columns:repeat(4,minmax(0,1fr))!important;align-items:stretch}
  .header-controls>#support-project-link,.header-controls>#open-account-btn{display:none!important}
  .header-controls>.btn,.mobile-header-more>summary{min-height:44px}
  .mobile-header-more{display:block;position:relative;min-width:0}
  .mobile-header-more>summary{display:flex;align-items:center;justify-content:center;width:100%;padding:.5rem .25rem;border:1px solid #475569;border-radius:10px;background:#243247;color:#fff;cursor:pointer;list-style:none;font-size:.78rem;font-weight:900;touch-action:manipulation}
  .mobile-header-more>summary::-webkit-details-marker{display:none}
  .mobile-header-more>summary:focus-visible,.mobile-header-menu .btn:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}
  .mobile-header-menu{position:absolute;right:0;top:calc(100% + .45rem);z-index:95;display:grid;gap:.4rem;width:min(250px,calc(100vw - 1.5rem));padding:.55rem;border:1px solid #64748b;border-radius:12px;background:rgba(15,23,42,.99);box-shadow:0 18px 45px rgba(0,0,0,.55);backdrop-filter:blur(14px)}
  .mobile-header-menu .btn{min-height:44px;width:100%;display:flex;align-items:center;justify-content:flex-start;text-decoration:none;text-align:left}
}
`;

function ensureStyles(documentRef) {
  if (documentRef.getElementById('mobile-header-menu-styles')) return;
  const style = documentRef.createElement('style');
  style.id = 'mobile-header-menu-styles';
  style.textContent = STYLE_TEXT;
  documentRef.head.appendChild(style);
}

export function initMobileHeaderMenu({ documentRef = document, windowRef = window } = {}) {
  try {
    const controls = documentRef.querySelector('.header-controls');
    const account = documentRef.getElementById('open-account-btn');
    const support = documentRef.getElementById('support-project-link');
    if (!controls || !account || !support) return null;
    ensureStyles(documentRef);

    let details = controls.querySelector('.mobile-header-more');
    if (!details) {
      details = documentRef.createElement('details');
      details.className = 'mobile-header-more';
      const summary = documentRef.createElement('summary');
      summary.textContent = 'More';
      summary.setAttribute('aria-label', 'More site options');
      const menu = documentRef.createElement('div');
      menu.className = 'mobile-header-menu';
      menu.setAttribute('aria-label', 'More site options');

      const accountProxy = documentRef.createElement('button');
      accountProxy.type = 'button';
      accountProxy.className = 'btn secondary mobile-account-proxy';
      accountProxy.dataset.drawerOpen = 'account';

      const howTo = documentRef.createElement('a');
      howTo.className = 'btn secondary';
      howTo.href = '/how-to.html';
      howTo.textContent = 'How To & Help';

      const supportProxy = documentRef.createElement('a');
      supportProxy.className = 'btn secondary mobile-support-proxy';
      supportProxy.href = support.href;
      supportProxy.target = '_blank';
      supportProxy.rel = 'noopener noreferrer';
      supportProxy.textContent = 'Support Project';

      menu.append(accountProxy, howTo, supportProxy);
      details.append(summary, menu);
      controls.appendChild(details);

      const syncAccountLabel = () => {
        const label = account.textContent?.trim() || 'Sign In';
        accountProxy.textContent = label === 'Sign In' ? 'Sign In / My Dice' : label;
        accountProxy.setAttribute('aria-label', label === 'Sign In' ? 'Sign in or open My Dice account' : label);
      };
      syncAccountLabel();
      if (typeof windowRef.MutationObserver === 'function') {
        const observer = new windowRef.MutationObserver(syncAccountLabel);
        observer.observe(account, { childList: true, characterData: true, subtree: true });
      }

      menu.addEventListener('click', () => { details.open = false; });
      documentRef.addEventListener('click', (event) => {
        if (details.open && !details.contains(event.target)) details.open = false;
      });
      documentRef.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && details.open) {
          details.open = false;
          summary.focus();
        }
      });
    }
    return details;
  } catch (error) {
    console.error('Failed to initialize mobile header menu:', error);
    return null;
  }
}
