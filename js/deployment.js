export function assertStylesLoaded() {
  try {
    const hasStyles = [...document.styleSheets].some(sheet =>
      sheet.href?.includes('/styles.css')
    );

    if (hasStyles) return true;

    const warning = document.createElement('div');
    warning.textContent = 'Deployment error: styles.css did not load.';
    Object.assign(warning.style, {
      position: 'fixed',
      inset: '0 0 auto 0',
      zIndex: '99999',
      padding: '12px 16px',
      background: '#7f1d1d',
      color: '#fff',
      font: '700 14px system-ui, sans-serif',
      textAlign: 'center',
    });
    document.body.prepend(warning);
    console.error('Deployment validation failed: styles.css is unavailable.');
    return false;
  } catch (err) {
    console.error('Stylesheet validation failed:', err);
    return false;
  }
}
