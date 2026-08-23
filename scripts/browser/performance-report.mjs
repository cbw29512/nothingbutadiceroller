export const PERFORMANCE_EXPRESSION = `(() => {
  const resources = performance.getEntriesByType('resource');
  const navigation = performance.getEntriesByType('navigation')[0];
  return {
    resourceCount: resources.length,
    transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    durationMs: navigation ? Math.round(navigation.duration) : null,
    domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
    appearanceScripts: resources
      .map((entry) => new URL(entry.name).pathname)
      .filter((path) => path.startsWith('/js/appearance/')),
  };
})()`;

export function formatPerformance(label, metrics) {
  const transferKiB = (Number(metrics.transferBytes || 0) / 1024).toFixed(1);
  return `${label}: ${metrics.resourceCount} resources, ${transferKiB} KiB transferred, navigation ${metrics.durationMs ?? 'n/a'} ms, DOMContentLoaded ${metrics.domContentLoadedMs ?? 'n/a'} ms`;
}
