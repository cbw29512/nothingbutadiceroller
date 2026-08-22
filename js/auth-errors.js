const SAFE_MESSAGES = new Set([
  'Email and password are required.',
  'Enter your email address first.',
  'Invite token and password are required.',
  'Enter a new password.',
  'No account link is active.',
]);

const FALLBACKS = {
  login: 'Unable to sign in. Check your email and password and try again.',
  signup: 'Unable to create the account. Check your details and try again.',
  recovery: 'Unable to send the password reset email. Try again.',
  callback: 'Unable to verify this account link. Request a new link and try again.',
  account: 'Unable to complete the account request. Try again.',
};

export function friendlyAuthError(error, action = 'account') {
  const raw = String(error?.message || error || '').trim();
  if (SAFE_MESSAGES.has(raw)) return raw;

  const message = raw.replace(/^[a-z0-9_-]+:\s*/i, '').trim();
  if (/email not confirmed/i.test(message)) {
    return 'This account still needs email confirmation. Check your confirmation email and try again.';
  }
  if (/no user found.*password invalid|invalid login credentials|email.*password.*(?:invalid|incorrect)/i.test(message)) {
    return 'Email or password is incorrect.';
  }
  if (/already.*registered|already.*exists|user.*exists|email.*(?:registered|exists)/i.test(message)) {
    return 'This email is already registered. Sign in or reset your password.';
  }
  if (/password.*(?:short|weak|6 characters|six characters)/i.test(message)) {
    return 'Password must be at least 6 characters.';
  }
  if (/token.*expired|expired.*token|invalid.*token/i.test(message)) {
    return 'This account link has expired or is invalid. Request a new link and try again.';
  }
  if (/failed to fetch|network|networkerror/i.test(message)) {
    return 'Unable to reach the account service. Check your connection and try again.';
  }

  return FALLBACKS[action] || FALLBACKS.account;
}
