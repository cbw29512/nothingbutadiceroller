import { authAction, refreshAccountUser } from './account-api.js';
import { setAccountMessage } from './account-ui.js';

let pendingCallback = null;

function ensureAuthMarkup() {
  const signedOut = document.getElementById('account-signed-out');
  const drawer = document.querySelector('#account-drawer .drawer-content');
  if (!signedOut || !drawer) return;

  signedOut.innerHTML = `
    <p>Sign in to save dice configurations permanently and load them on other devices.</p>
    <div class="save-config-form account-auth-form">
      <label for="account-auth-email" class="section-label">Email</label>
      <input id="account-auth-email" class="text-input" type="email" autocomplete="email" placeholder="you@example.com">
      <label for="account-auth-password" class="section-label">Password</label>
      <input id="account-auth-password" class="text-input" type="password" autocomplete="current-password" minlength="6" placeholder="Password">
      <div class="account-auth-actions">
        <button id="account-login-btn" class="btn primary" type="button">Sign In</button>
        <button id="account-signup-btn" class="btn secondary" type="button">Create Account</button>
      </div>
      <button id="account-recovery-btn" class="btn ghost" type="button">Forgot password?</button>
    </div>`;

  if (!document.getElementById('account-callback-panel')) {
    const panel = document.createElement('div');
    panel.id = 'account-callback-panel';
    panel.className = 'account-panel hidden';
    panel.innerHTML = `
      <div class="save-config-form">
        <strong id="account-callback-title">Finish account setup</strong>
        <label for="account-callback-password" class="section-label">New password</label>
        <input id="account-callback-password" class="text-input" type="password" autocomplete="new-password" minlength="6" placeholder="Choose a password">
        <button id="account-callback-submit" class="btn primary" type="button">Continue</button>
      </div>`;
    signedOut.after(panel);
  }
}

function accountDrawer(open = true) {
  const drawer = document.getElementById('account-drawer');
  drawer?.classList.toggle('hidden', !open);
  drawer?.setAttribute('aria-hidden', String(!open));
}

function clearAuthHash() {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

function showCallback(type, token) {
  pendingCallback = { type, token };
  document.getElementById('account-callback-panel')?.classList.remove('hidden');
  document.getElementById('account-signed-out')?.classList.add('hidden');
  const title = document.getElementById('account-callback-title');
  if (title) title.textContent = type === 'invite' ? 'Finish creating your account' : 'Set a new password';
  accountDrawer(true);
}

function credentials() {
  return {
    email: document.getElementById('account-auth-email')?.value.trim() || '',
    password: document.getElementById('account-auth-password')?.value || '',
  };
}

async function refresh(onSession, initial = false) {
  const user = await refreshAccountUser({ initial });
  onSession(user);
  return user;
}

async function processHash(onSession) {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const confirmation = params.get('confirmation_token');
  const invite = params.get('invite_token');
  const recovery = params.get('recovery_token');

  if (invite) {
    showCallback('invite', invite);
    setAccountMessage('Invitation found. Set a password to finish your account.');
    return;
  }
  if (recovery) {
    showCallback('recovery', recovery);
    setAccountMessage('Recovery link verified. Choose a new password.');
    return;
  }
  if (!confirmation) return;

  try {
    setAccountMessage('Confirming your email…');
    await authAction('confirm', { token: confirmation });
    clearAuthHash();
    const user = await refresh(onSession);
    setAccountMessage(
      user ? 'Email confirmed. You are signed in.' : 'Email confirmed. Sign in to continue.',
      'ready',
    );
    accountDrawer(true);
  } catch (error) {
    console.error('Email confirmation failed:', error);
    setAccountMessage(error.message, 'error');
    accountDrawer(true);
  }
}

export async function initAuthUI(onSession) {
  ensureAuthMarkup();
  document.getElementById('account-login-btn')?.addEventListener('click', async () => {
    try {
      setAccountMessage('Signing in…');
      await authAction('login', credentials());
      const user = await refresh(onSession);
      setAccountMessage(user ? 'Signed in.' : 'Sign-in completed, but the session was not restored.', user ? 'ready' : 'error');
    } catch (error) { setAccountMessage(error.message, 'error'); }
  });
  document.getElementById('account-signup-btn')?.addEventListener('click', async () => {
    try {
      setAccountMessage('Creating account…');
      const data = await authAction('signup', credentials());
      const user = await refresh(onSession);
      setAccountMessage(user ? 'Account created and signed in.' : data.message || 'Check your email to confirm your account.', 'ready');
    } catch (error) { setAccountMessage(error.message, 'error'); }
  });
  document.getElementById('account-recovery-btn')?.addEventListener('click', async () => {
    try {
      const email = credentials().email;
      if (!email) throw new Error('Enter your email address first.');
      const data = await authAction('request-recovery', { email });
      setAccountMessage(data.message, 'ready');
    } catch (error) { setAccountMessage(error.message, 'error'); }
  });
  document.getElementById('account-callback-submit')?.addEventListener('click', async () => {
    try {
      if (!pendingCallback) throw new Error('No account link is active.');
      const password = document.getElementById('account-callback-password')?.value || '';
      const action = pendingCallback.type === 'invite' ? 'accept-invite' : 'recover';
      setAccountMessage('Finishing account setup…');
      await authAction(action, { token: pendingCallback.token, password });
      pendingCallback = null;
      clearAuthHash();
      document.getElementById('account-callback-panel')?.classList.add('hidden');
      const user = await refresh(onSession);
      setAccountMessage(user ? 'Account ready. You are signed in.' : 'Account ready. Sign in to continue.', 'ready');
    } catch (error) { setAccountMessage(error.message, 'error'); }
  });

  try { await refresh(onSession, true); }
  catch (error) {
    console.error('Initial account session check failed:', error);
    onSession(null);
    setAccountMessage('Guest mode active. Sign in to sync saved dice.');
  }
  await processHash(onSession);
}

export async function signOutAccount(onSession) {
  await authAction('logout');
  await refresh(onSession);
  setAccountMessage('Signed out.', 'ready');
}
