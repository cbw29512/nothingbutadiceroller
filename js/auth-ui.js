import {
  acceptInviteAccount,
  completeRecoveryAccount,
  loginAccount,
  logoutAccount,
  processIdentityCallback,
  refreshAccountUser,
  requestRecoveryAccount,
  signupAccount,
} from './account-api.js';
import { friendlyAuthError } from './auth-errors.js';
import { setAccountMessage } from './account-ui.js';

let pendingCallback = null;

function ensureAuthMarkup() {
  const signedOut = document.getElementById('account-signed-out');
  if (!signedOut) return;

  signedOut.innerHTML = `
    <p>Sign in to save dice configurations to your account and load them on other devices.</p>
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

  if (document.getElementById('account-callback-panel')) return;
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

function accountDrawer(open = true) {
  const drawer = document.getElementById('account-drawer');
  drawer?.classList.toggle('hidden', !open);
  drawer?.setAttribute('aria-hidden', String(!open));
}

function showCallback(type, token = null) {
  pendingCallback = { type, token };
  document.getElementById('account-callback-panel')?.classList.remove('hidden');
  document.getElementById('account-signed-out')?.classList.add('hidden');
  const title = document.getElementById('account-callback-title');
  if (title) title.textContent = type === 'invite' ? 'Finish creating your account' : 'Set a new password';
  accountDrawer(true);
}

function hideCallback() {
  pendingCallback = null;
  document.getElementById('account-callback-panel')?.classList.add('hidden');
}

function credentials() {
  return {
    email: document.getElementById('account-auth-email')?.value.trim() || '',
    password: document.getElementById('account-auth-password')?.value || '',
  };
}

async function processCallback(onSession) {
  const hasAuthHash = /(?:confirmation|invite|recovery|email_change)_token=|access_token=/.test(location.hash);
  if (!hasAuthHash) return false;

  try {
    setAccountMessage('Finishing account verification…');
    const result = await processIdentityCallback();
    if (!result) return false;

    if (result.type === 'invite') {
      showCallback('invite', result.token);
      setAccountMessage('Invitation verified. Choose a password to finish your account.');
      return true;
    }
    if (result.type === 'recovery') {
      onSession(result.user);
      showCallback('recovery');
      setAccountMessage('Recovery link verified. Choose a new password.');
      return true;
    }

    hideCallback();
    onSession(result.user);
    setAccountMessage(
      result.type === 'confirmation' ? 'Email confirmed. You are signed in.' : 'Account verified. You are signed in.',
      'ready',
    );
    accountDrawer(true);
    return true;
  } catch (error) {
    console.error('Identity callback failed:', error);
    setAccountMessage(friendlyAuthError(error, 'callback'), 'error');
    accountDrawer(true);
    return true;
  }
}

export async function initAuthUI(onSession) {
  ensureAuthMarkup();

  document.getElementById('account-login-btn')?.addEventListener('click', async () => {
    try {
      setAccountMessage('Signing in…');
      const { email, password } = credentials();
      const user = await loginAccount(email, password);
      onSession(user);
      setAccountMessage('Signed in.', 'ready');
    } catch (error) { setAccountMessage(friendlyAuthError(error, 'login'), 'error'); }
  });

  document.getElementById('account-signup-btn')?.addEventListener('click', async () => {
    try {
      setAccountMessage('Creating account…');
      const { email, password } = credentials();
      const { user } = await signupAccount(email, password);
      onSession(user);
      setAccountMessage(user ? 'Account created and signed in.' : 'Account created. Check your email to confirm it.', 'ready');
    } catch (error) { setAccountMessage(friendlyAuthError(error, 'signup'), 'error'); }
  });

  document.getElementById('account-recovery-btn')?.addEventListener('click', async () => {
    try {
      await requestRecoveryAccount(credentials().email);
      setAccountMessage('If that account exists, a password reset email is on the way.', 'ready');
    } catch (error) { setAccountMessage(friendlyAuthError(error, 'recovery'), 'error'); }
  });

  document.getElementById('account-callback-submit')?.addEventListener('click', async () => {
    try {
      if (!pendingCallback) throw new Error('No account link is active.');
      const password = document.getElementById('account-callback-password')?.value || '';
      const user = pendingCallback.type === 'invite'
        ? await acceptInviteAccount(pendingCallback.token, password)
        : await completeRecoveryAccount(password);
      hideCallback();
      onSession(user);
      setAccountMessage('Account ready. You are signed in.', 'ready');
    } catch (error) { setAccountMessage(friendlyAuthError(error, 'callback'), 'error'); }
  });

  const callbackHandled = await processCallback(onSession);
  if (callbackHandled) return;

  try {
    const user = await refreshAccountUser({ initial: true });
    onSession(user);
    if (!user) setAccountMessage('Guest mode active. Sign in to sync saved dice.');
  } catch (error) {
    console.error('Initial account session check failed:', error);
    onSession(null);
    setAccountMessage('Guest mode active. Sign in to sync saved dice.');
  }
}

export async function signOutAccount(onSession) {
  await logoutAccount();
  onSession(null);
  setAccountMessage('Signed out.', 'ready');
}
