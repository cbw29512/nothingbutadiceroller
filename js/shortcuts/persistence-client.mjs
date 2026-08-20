import {
  normalizeShortcutSlots,
  validateStoredShortcutWorkspace,
} from './persistence.mjs';

export class ShortcutPersistenceError extends Error {
  constructor(message, { status = 0, code = 'shortcut-persistence-error', latest = null } = {}) {
    super(message);
    this.name = 'ShortcutPersistenceError';
    this.status = status;
    this.code = code;
    this.latest = latest;
  }
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const latest = data?.workspace
      ? {
          workspace: validateStoredShortcutWorkspace(data.workspace),
          version: typeof data.version === 'string' ? data.version : null,
        }
      : null;
    throw new ShortcutPersistenceError(data?.error || 'Shortcut persistence request failed.', {
      status: response.status,
      code: data?.code || 'shortcut-persistence-error',
      latest,
    });
  }
  return data;
}

async function shortcutFetch(method, body) {
  const options = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  return parseResponse(await fetch('/api/shortcuts', options));
}

function normalizeVersion(version) {
  if (version === null) return null;
  if (typeof version !== 'string' || version.length < 1) {
    throw new ShortcutPersistenceError('Load shortcuts before saving so the storage version is known.', {
      code: 'shortcut-version-required',
    });
  }
  return version;
}

function normalizeServerState(data) {
  return Object.freeze({
    workspace: validateStoredShortcutWorkspace(data.workspace),
    version: data.version === null ? null : normalizeVersion(data.version),
  });
}

export async function loadShortcutWorkspace() {
  return normalizeServerState(await shortcutFetch('GET'));
}

export async function saveShortcutWorkspace(shortcuts, version) {
  const normalized = normalizeShortcutSlots(shortcuts);
  return normalizeServerState(await shortcutFetch('PUT', {
    version: normalizeVersion(version),
    shortcuts: normalized,
  }));
}

export async function clearShortcutWorkspace(version) {
  return normalizeServerState(await shortcutFetch('DELETE', {
    version: normalizeVersion(version),
  }));
}
