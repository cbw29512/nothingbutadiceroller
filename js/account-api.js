let currentUser = null;
const listeners = new Map();

function emit(event, user) {
  listeners.get(event)?.forEach((callback) => {
    try { callback(user); } catch (error) { console.error(`Auth ${event} listener failed:`, error); }
  });
}

const identityFacade = {
  currentUser: () => currentUser,
  on(event, callback) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(callback);
    if (event === 'init') queueMicrotask(() => callback(currentUser));
  },
};

export function getIdentity() {
  return identityFacade;
}

export function setAccountUser(user, { initial = false } = {}) {
  const previous = currentUser;
  currentUser = user || null;
  if (initial) emit('init', currentUser);
  else if (!previous && currentUser) emit('login', currentUser);
  else if (previous && !currentUser) emit('logout', null);
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Account request failed.');
  return data;
}

export async function refreshAccountUser(options = {}) {
  const response = await fetch('/api/auth', {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await parseResponse(response);
  setAccountUser(data.user, options);
  return data.user || null;
}

export async function authAction(action, payload = {}) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return parseResponse(response);
}

export async function accountFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return parseResponse(response);
}
