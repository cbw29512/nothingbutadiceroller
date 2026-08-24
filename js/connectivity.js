const CONNECTIVITY_PROBE_PATH = '/robots.txt';
const CONNECTIVITY_PROBE_TIMEOUT_MS = 2500;

function probeUrl(now = Date.now) {
  try {
    return `${CONNECTIVITY_PROBE_PATH}?ndr-connectivity=${encodeURIComponent(String(now()))}`;
  } catch (error) {
    console.error('Failed to build connectivity probe URL:', error);
    return CONNECTIVITY_PROBE_PATH;
  }
}

export async function detectOfflineMode({
  navigatorRef = globalThis.navigator,
  fetchImpl = globalThis.fetch,
  timeoutMs = CONNECTIVITY_PROBE_TIMEOUT_MS,
  now = Date.now,
} = {}) {
  let timeoutId = null;
  try {
    if (navigatorRef?.onLine === false) return true;
    if (typeof fetchImpl !== 'function') {
      console.warn('Connectivity probe is unavailable; using offline-safe Default Dice startup.');
      return true;
    }

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    await fetchImpl(probeUrl(now), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    return false;
  } catch (error) {
    console.warn('Origin connectivity probe failed; using offline-safe Default Dice startup:', error);
    return true;
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

export const CONNECTIVITY_PROBE = Object.freeze({
  path: CONNECTIVITY_PROBE_PATH,
  timeoutMs: CONNECTIVITY_PROBE_TIMEOUT_MS,
});
