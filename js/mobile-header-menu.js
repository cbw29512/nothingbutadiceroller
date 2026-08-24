export function initMobileHeaderMenu({ documentRef = document, windowRef = window } = {}) {
  try {
    const controls = documentRef.querySelector('.header-controls');
    const account = documentRef.getElementById('open-account-btn');
    const support = documentRef.getElementById('support-project-link');
    if (!controls || !account || !support) return null;

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
