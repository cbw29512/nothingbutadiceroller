export function initOfflineSupport({ windowRef = window, navigatorRef = navigator } = {}) {
  try {
    if (!navigatorRef?.serviceWorker?.register) return false;
    const protocol = String(windowRef.location?.protocol || '');
    const hostname = String(windowRef.location?.hostname || '');
    const secureEnough = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
    if (!secureEnough) return false;

    const register = async () => {
      try {
        const registration = await navigatorRef.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        windowRef.dispatchEvent(new CustomEvent('offlineappregistered', {
          detail: { scope: registration.scope },
        }));
      } catch (error) {
        console.warn('Offline roller support could not be registered:', error);
      }
    };

    if (document.readyState === 'complete') windowRef.setTimeout(register, 0);
    else windowRef.addEventListener('load', () => windowRef.setTimeout(register, 0), { once: true });
    return true;
  } catch (error) {
    console.warn('Offline roller support is unavailable:', error);
    return false;
  }
}
