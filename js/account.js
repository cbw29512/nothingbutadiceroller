import { state, savePreferences } from './state.js';
import { clearPhysics } from './physics.js';
import { renderPool, renderResults } from './ui.js';
import { accountFetch, getIdentity } from './account-api.js';
import { renderAccountView, setAccountMessage } from './account-ui.js';

let savedConfigurations = [];
let accountUser = null;
let defaultAppliedForUser = null;

function renderAccount() {
  renderAccountView({
    user: accountUser,
    configurations: savedConfigurations,
    onLoad: applyConfiguration,
    onDelete: deleteConfiguration,
  });
}

async function applyConfiguration(config, showMessage = true) {
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
    if (showMessage) setAccountMessage(`Loaded “${config.name}”.`, 'ready');
  } catch (error) {
    console.error('Failed to load configuration:', error);
    setAccountMessage(error.message, 'error');
  }
}

async function loadConfigurations() {
  if (!accountUser) {
    savedConfigurations = [];
    renderAccount();
    return;
  }

  try {
    setAccountMessage('Loading saved dice…');
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
      setAccountMessage(`Restored default “${defaultConfig.name}”.`, 'ready');
      return;
    }

    setAccountMessage(`${savedConfigurations.length} saved configuration${savedConfigurations.length === 1 ? '' : 's'}.`, 'ready');
  } catch (error) {
    console.error('Failed to load saved configurations:', error);
    setAccountMessage(error.message, 'error');
  }
}

async function saveCurrentConfiguration() {
  try {
    const name = document.getElementById('config-name')?.value.trim();
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
    renderAccount();
    setAccountMessage(`Saved “${name}”.`, 'ready');
  } catch (error) {
    console.error('Failed to save configuration:', error);
    setAccountMessage(error.message, 'error');
  }
}

async function deleteConfiguration(id) {
  try {
    const data = await accountFetch(`/api/configurations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    savedConfigurations = data.configurations || [];
    renderAccount();
    setAccountMessage('Configuration deleted.', 'ready');
  } catch (error) {
    console.error('Failed to delete configuration:', error);
    setAccountMessage(error.message, 'error');
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
  const auth = getIdentity();
  if (!auth) {
    setAccountMessage('Account service failed to load. Guest mode is still available.', 'error');
    return;
  }

  auth.on('init', handleIdentityUser);
  auth.on('login', (user) => { auth.close(); handleIdentityUser(user); });
  auth.on('logout', () => handleIdentityUser(null));
  auth.on('error', (error) => {
    console.error('Netlify Identity error:', error);
    setAccountMessage('Account login is unavailable until Netlify Identity is enabled.', 'error');
  });
  auth.init();

  document.getElementById('account-login-btn')?.addEventListener('click', () => auth.open('login'));
  document.getElementById('account-signup-btn')?.addEventListener('click', () => auth.open('signup'));
  document.getElementById('account-logout-btn')?.addEventListener('click', () => auth.logout());
  document.getElementById('save-config-btn')?.addEventListener('click', saveCurrentConfiguration);
}
