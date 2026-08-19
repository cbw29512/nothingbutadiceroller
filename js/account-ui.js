export function setAccountMessage(message, kind = '') {
  const el = document.getElementById('account-status');
  if (!el) return;
  el.textContent = message;
  el.className = `status-line ${kind}`.trim();
}

export function renderAccountView({ user, configurations, onLoad, onDelete }) {
  const signedOut = document.getElementById('account-signed-out');
  const signedIn = document.getElementById('account-signed-in');
  const accountBtn = document.getElementById('open-account-btn');
  signedOut?.classList.toggle('hidden', Boolean(user));
  signedIn?.classList.toggle('hidden', !user);
  if (accountBtn) accountBtn.textContent = user ? 'My Dice' : 'Sign In';

  const email = document.getElementById('account-email');
  if (email) email.textContent = user?.email || '';

  const list = document.getElementById('saved-config-list');
  if (!list) return;
  list.replaceChildren();

  if (!user) {
    list.textContent = 'Sign in to access persistent saved dice.';
    return;
  }
  if (!configurations.length) {
    list.textContent = 'No saved configurations yet.';
    return;
  }

  configurations.forEach((config) => {
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
    load.addEventListener('click', () => onLoad(config));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => onDelete(config.id));

    actions.append(load, remove);
    row.append(copy, actions);
    list.appendChild(row);
  });
}
