export function ensureSkipLink(doc = document) {
  try {
    const existing = doc.getElementById('skip-to-roller');
    if (existing) return existing;

    const main = doc.getElementById('main-content');
    const app = doc.getElementById('app');
    if (!main || !app) return null;

    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');

    const link = doc.createElement('a');
    link.id = 'skip-to-roller';
    link.className = 'skip-link';
    link.href = '#main-content';
    link.textContent = 'Skip to dice roller';
    link.addEventListener('click', () => {
      queueMicrotask(() => main.focus({ preventScroll: false }));
    });
    app.parentNode?.insertBefore(link, app);
    return link;
  } catch (error) {
    console.error('Failed to initialize skip navigation:', error);
    return null;
  }
}
