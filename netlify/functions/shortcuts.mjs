import { getStore } from '@netlify/blobs';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import {
  DEFAULT_SHORTCUT_OPTIONS,
  SHORTCUT_WORKSPACE_MAX_BYTES,
  ShortcutWorkspaceValidationError,
  createEmptyShortcutWorkspace,
  createStoredShortcutWorkspace,
  normalizeShortcutOptions,
  normalizeShortcutSlots,
  validateStoredShortcutWorkspace,
} from '../../js/shortcuts/persistence.mjs';

const STORE_NAME = 'dice-user-shortcuts-v1';
const WRITE_KEYS = new Set(['version', 'shortcuts', 'options']);
const CLEAR_KEYS = new Set(['version']);

class ShortcutStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ShortcutStorageError';
  }
}

function responseHeaders() {
  return {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie',
  };
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: responseHeaders() });
}

function userKey(userId) {
  return `users/${encodeURIComponent(String(userId))}/shortcuts-v1.json`;
}

function shortcutStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function rejectUnknownKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ShortcutWorkspaceValidationError([`${key} is not allowed`]);
  }
}

function requireVersion(body) {
  if (!Object.prototype.hasOwnProperty.call(body, 'version')) {
    throw new ShortcutWorkspaceValidationError(['version is required; load the workspace before saving']);
  }
  if (body.version !== null && (typeof body.version !== 'string' || body.version.length < 1 || body.version.length > 300)) {
    throw new ShortcutWorkspaceValidationError(['version must be null or a valid storage version']);
  }
  return body.version;
}

async function readJsonBody(request, allowedKeys) {
  const text = await request.text();
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > SHORTCUT_WORKSPACE_MAX_BYTES) {
    throw new ShortcutWorkspaceValidationError([`request cannot exceed ${SHORTCUT_WORKSPACE_MAX_BYTES} bytes`]);
  }

  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ShortcutWorkspaceValidationError(['request body must be valid JSON']);
  }
  if (!isPlainObject(body)) throw new ShortcutWorkspaceValidationError(['request body must be an object']);
  rejectUnknownKeys(body, allowedKeys);
  return body;
}

async function readWorkspace(store, key) {
  let entry;
  try {
    entry = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
  } catch (error) {
    console.error('Shortcut store read failed:', error);
    throw new ShortcutStorageError('Unable to read shortcut storage.');
  }

  if (!entry) return { workspace: createEmptyShortcutWorkspace(), version: null };

  try {
    return {
      workspace: validateStoredShortcutWorkspace(entry.data),
      version: entry.etag,
    };
  } catch (error) {
    console.error('Stored shortcut workspace is invalid:', error);
    throw new ShortcutStorageError('Stored shortcut data failed validation.');
  }
}

function conflict(latest) {
  return json({
    error: 'Shortcut data changed in another session. Reload before saving again.',
    code: 'shortcut-version-conflict',
    workspace: latest.workspace,
    version: latest.version,
  }, 409);
}

async function conditionalWrite(store, key, current, shortcuts, options) {
  const workspace = createStoredShortcutWorkspace(shortcuts, {
    revision: current.workspace.revision + 1,
    updatedAt: new Date().toISOString(),
    options,
  });

  let result;
  try {
    result = current.version
      ? await store.setJSON(key, workspace, { onlyIfMatch: current.version })
      : await store.setJSON(key, workspace, { onlyIfNew: true });
  } catch (error) {
    console.error('Shortcut store write failed:', error);
    throw new ShortcutStorageError('Unable to write shortcut storage.');
  }

  if (!result?.modified || !result?.etag) return null;
  return { workspace, version: result.etag };
}

async function saveWorkspace(request, store, key, clear = false) {
  verifyRequestOrigin(request);
  const body = await readJsonBody(request, clear ? CLEAR_KEYS : WRITE_KEYS);
  const expectedVersion = requireVersion(body);
  const shortcuts = clear ? [] : normalizeShortcutSlots(body.shortcuts);
  const options = clear ? DEFAULT_SHORTCUT_OPTIONS : normalizeShortcutOptions(body.options);
  const current = await readWorkspace(store, key);

  if (expectedVersion !== current.version) return conflict(current);

  const saved = await conditionalWrite(store, key, current, shortcuts, options);
  if (saved) return json(saved);

  const latest = await readWorkspace(store, key);
  return conflict(latest);
}

export default async (request) => {
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.', code: 'authentication-required' }, 401);

    const store = shortcutStore();
    const key = userKey(user.id);

    if (request.method === 'GET') {
      const current = await readWorkspace(store, key);
      return json(current);
    }
    if (request.method === 'PUT') return await saveWorkspace(request, store, key, false);
    if (request.method === 'DELETE') return await saveWorkspace(request, store, key, true);

    return json({ error: 'Method Not Allowed' }, 405);
  } catch (error) {
    if (error instanceof ShortcutWorkspaceValidationError) {
      return json({ error: error.message, issues: error.issues, code: 'invalid-shortcut-workspace' }, 400);
    }
    if (error instanceof ShortcutStorageError) {
      return json({ error: error.message, code: 'shortcut-storage-error' }, 500);
    }
    const status = Number(error?.status || error?.statusCode) || 500;
    if (status === 403) return json({ error: 'Request origin is not allowed.', code: 'invalid-origin' }, 403);
    console.error('Shortcut persistence API failed:', error);
    return json({ error: 'Shortcut persistence request failed.', code: 'shortcut-persistence-failed' }, status >= 400 && status < 600 ? status : 500);
  }
};

export const config = { path: '/api/shortcuts' };
