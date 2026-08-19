import { state, savePreferences } from './state.js';
import { clearPhysics } from './physics.js';
import { renderPool, renderResults } from './ui.js';

let savedConfigurations = [];
let accountUser = null;
let defaultAppliedForUser = null;

function identity() {
  return window.netlifyIdentity || null;
}

async function accountFetch(url, options = {}) {
  const user = identity()?.currentUser();
  if (!user) throw new Error('Sign in to use saved dice.');

  const token = await user.jwt();
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Account request failed.');
  return data;
}

function setMessage(message, kind = '') {
  const el = document.getElementById('account-status');
  if (!el) return;
  el.textContent = message;
  el.className = `status-line ${kind}`.trim();
}

function renderConfigurations() {
  const list = document.getElementById('saved-config-list');
  if (!list) return;
  list.replaceChildren();

  if (!accountUser) {
    list.textContent = 'Sign in to access persistent saved dice.';
    return;
  }
  if (!savedConfigurations.length) {
    list.textContent = 'No saved configurations yet.';
    return;
  }

  savedConfigurations.forEach((config) => {
    const row = document.createElement('div');
    row.className = 'saved-config-item';

    const copy = document.createElement('div');
    copy.className = 'saved-config-copy';
    const name = document.createElement('strong');
    name.textContent = `${config.name}${config.isDefault ? ' ★' : ''}`;
    const meta = document.createElement('span');
    const tray = String(config.trayTheme || 'tray').replace('tray-', '').replaceAll('_', ' ');
    meta.textContent = `${config.selectedDice?.length || 0} dice • ${tray}`;
    copy.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'saved-config-actions';
    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'btn secondary';
    load.textContent = 'Load';
    load.onclick = () => applyConfiguration(config);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.textContent = 'Delete';
    remove.onclick = () => deleteConfiguration(config.id);
    actions.append(load, remove);
    row.append(copy, actions);
    list.appendChild(row);
  });
}

function renderAccount() {
  const signedOut = document.getElementById('account-signed-out');
  const signedIn = document.getElementById('account-signed-in');
  const accountBtn = document.getElementById('open-account-btn');
  signedOut?.classList.toggle('hidden', Boolean(accountUser));
  signedIn?.classList.toggle('hidden', !accountUser);
  if (accountBtn) accountBtn.textContent = accountUser ? 'My Dice' : 'Sign In';

  const email = document.getElementById('account-email');
  if (email) email.textContent = accountUser?.email || '';
  renderConfigurations();
}

async function applyConfiguration(config, message = true) {
  try {
    state.selectedDice = (config.selectedDice || []).map((die) => ({ type: die.type }));
    state.trayTheme = config.trayTheme || state.trayTheme;
    state.dieSkin = config.dieSkin || state.dieSkin;
    state.keepDice = Boolean(config.keepDice);
    state.d20Mode = 'normal';
    state.hasRolled = false;
    savePreferences();
    renderPool();
    renderResults();
    await clearPhysics();
    document.dispatchEvent(new Event('configurationloaded'));
    if (message) setMessage(`Loaded “${config.name}”.`, 'ready');
  } catch (error) {
    console.error('Failed to load configuration:', error);
    setMessage(error.message, 'error');
  }
}

async function loadConfigurations() {
  if (!accountUser) {
    savedConfigurations = [];
    renderAccount();
    return;
  }

  try {
    setMessage('Loading saved dice…');
    const data = await accountFetch('/api/configurations');
    savedConfigurations = data.configurations || [];
    renderAccount();

    const defaultConfig = savedConfigurations.find((item) => item.isDefault);
    const shouldRestoreDefault = defaultConfig
      && defaultAppliedForUser !== accountUser.id
      && state.selectedDice.length === 0
      && !state.hasRolled;

    if (shouldRestoreDefault) {
      defaultAppliedForUser = accountUser.id;
      await applyConfiguration(defaultConfig, false);
      setMessage(`Restored default “${defaultConfig.name}”.`, 'ready');
      return;
    }

    setMessage(`${savedConfigurations.length} saved configuration${savedConfigurations.length === 1 ? '' : 's'}.`, 'ready');
  } catch (error) {
    console.error('Failed to load saved configurations:', error);
    setMessage(error.message, 'error');
  }
}

async function saveCurrentConfiguration() {
  try {
    const nameInput = document.getElementById('config-name');
    const name = nameInput?.value.trim();
    if (!name) throw new Error('Give this configuration a name.');
    const existing = savedConfigurations.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const isDefault = Boolean(document.getElementById('config-default')?.checked);

    const data = await accountFetch('/api/configurations', {
      method: 'POST',
      body: JSON.stringify({
        id: existing?.id,
        name,
        selectedDice: state.selectedDice,
        trayTheme: state.trayTheme,
        dieSkin: state.dieSkin,
        keepDice: state.keepDice,
        isDefault,
      }),
    });
    savedConfigurations = data.configurations || [];
    renderConfigurations();
    setMessage(`Saved “${name}”.`, 'ready');
  } catch (error) {
    console.error('Failed to save configuration:', error);
    setMessage(error.message, 'error');
  }
}

async function deleteConfiguration(id) {
  try {
    const data = await accountFetch(`/api/configurations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    savedConfigurations = data.configurations || [];
    renderConfigurations();
    setMessage('Configuration deleted.', 'ready');
  } catch (error) {
    console.error('Failed to delete configuration:', error);
    setMessage(error.message, 'error');
  }
}

function handleIdentityUser(user) {
  const nextId = user?.id || null;
  if (accountUser?.id !== nextId) defaultAppliedForUser = null;
  accountUser = user || null;
  renderAccount();
  loadConfigurations();
}

export function initAccount() {
  const auth = identity();
  if (!auth) {
    setMessage('Account service failed to load. Guest mode is still available.', 'error');
    return;
  }

  auth.on('init', handleIdentityUser);
  auth.on('login', (user) => { auth.close(); handleIdentityUser(user); });
  auth.on('logout', () => handleIdentityUser(null));
  auth.on('error', (error) => {
    console.error('Netlify Identity error:', error);
    setMessage('Account login is unavailable until Netlify Identity is enabled.', 'error');
  });
  auth.init();

  document.getElementById('account-login-btn')?.addEventListener('click', () => auth.open('login'));
  document.getElementById('account-signup-btn')?.addEventListener('click', () => auth.open('signup'));
  document.getElementById('account-logout-btn')?.addEventListener('click', () => auth.logout());
  document.getElementById('save-config-btn')?.addEventListener('click', saveCurrentConfiguration);
}
