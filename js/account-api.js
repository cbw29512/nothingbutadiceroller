import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  onAuthChange,
  requestPasswordRecovery,
  signup,
  updateUser,
} from '@netlify/identity';

let currentUser = null;
let authSubscriptionStarted = false;
const listeners = new Map();

function emit(event, user) {
  listeners.get(event)?.forEach((callback) => {
    try {
      callback(user);
    } catch (error) {
      console.error(`Auth ${event} listener failed:`, error);
    }
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

  if (initial) {
    emit('init', currentUser);
    return;
  }
  if (!previous && currentUser) emit('login', currentUser);
  else if (previous && !currentUser) emit('logout', null);
  else if (currentUser) emit('login', currentUser);
}

function ensureAuthSubscription() {
  if (authSubscriptionStarted) return;
  authSubscriptionStarted = true;

  onAuthChange((event, user) => {
    try {
      if (event === 'logout') {
        setAccountUser(null);
        return;
      }
      if (user) setAccountUser(user);
    } catch (error) {
      console.error('Netlify Identity auth-change handler failed:', error);
    }
  });
}

function normalizeCredentials(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');
  if (!normalizedEmail || !normalizedPassword) {
    throw new Error('Email and password are required.');
  }
  return { email: normalizedEmail, password: normalizedPassword };
}

export async function refreshAccountUser(options = {}) {
  ensureAuthSubscription();
  const user = await getUser();
  setAccountUser(user, options);
  return user || null;
}

export async function loginAccount(email, password) {
  ensureAuthSubscription();
  const credentials = normalizeCredentials(email, password);
  const user = await login(credentials.email, credentials.password);
  setAccountUser(user);
  return user;
}

export async function signupAccount(email, password) {
  ensureAuthSubscription();
  const credentials = normalizeCredentials(email, password);
  const createdUser = await signup(credentials.email, credentials.password);
  const sessionUser = await getUser();
  setAccountUser(sessionUser);
  return { createdUser, user: sessionUser || null };
}

export async function logoutAccount() {
  ensureAuthSubscription();
  await logout();
  setAccountUser(null);
}

export async function processIdentityCallback() {
  ensureAuthSubscription();
  const result = await handleAuthCallback();
  if (result?.user) setAccountUser(result.user);
  return result;
}

export async function acceptInviteAccount(token, password) {
  ensureAuthSubscription();
  if (!token || !password) throw new Error('Invite token and password are required.');
  const user = await acceptInvite(token, password);
  setAccountUser(user);
  return user;
}

export async function completeRecoveryAccount(password) {
  ensureAuthSubscription();
  if (!password) throw new Error('Enter a new password.');
  const user = await updateUser({ password });
  setAccountUser(user);
  return user;
}

export async function requestRecoveryAccount(email) {
  ensureAuthSubscription();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Enter your email address first.');
  await requestPasswordRecovery(normalizedEmail);
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Account request failed.');
  return data;
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
