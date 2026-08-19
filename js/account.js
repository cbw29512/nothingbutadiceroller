import { state, savePreferences } from './state.js';
import { clearPhysics } from './physics.js';
import { renderPool, renderResults } from './ui.js';
import { accountFetch } from './account-api.js';
import { renderAccountView, setAccountMessage } from './account-ui.js';
import { initAuthUI, signOutAccount } from './auth-ui.js';

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
    state.customAppearance = config.customAppearance || null;
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
    const shouldRestore = defaultConfig
      && defaultAppliedForUser !== accountUser.id
      && state.selectedDice.length === 0
      && !state.hasRolled;
    if (shouldRestore) {
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
    const data = await accountFetch('/api/configurations', {
      method: 'POST',
      body: JSON.stringify({
        id: existing?.id,
        name,
        selectedDice: state.selectedDice,
        trayTheme: state.trayTheme,
        dieSkin: state.dieSkin,
        customAppearance: state.customAppearance,
        keepDice: state.keepDice,
        isDefault: Boolean(document.getElementById('config-default')?.checked),
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

function handleSession(user) {
  if (accountUser?.id !== user?.id) defaultAppliedForUser = null;
  accountUser = user || null;
  renderAccount();
  loadConfigurations();
}

export function initAccount() {
  renderAccount();
  initAuthUI(handleSession).catch((error) => {
    console.error('Account initialization failed:', error);
    setAccountMessage('Account service is unavailable. Guest rolling still works.', 'error');
  });
  document.getElementById('account-logout-btn')?.addEventListener('click', async () => {
    try { await signOutAccount(handleSession); }
    catch (error) { setAccountMessage(error.message, 'error'); }
  });
  document.getElementById('save-config-btn')?.addEventListener('click', saveCurrentConfiguration);
}
