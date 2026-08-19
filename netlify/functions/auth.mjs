import {
  acceptInvite,
  confirmEmail,
  getUser,
  login,
  logout,
  recoverPassword,
  requestPasswordRecovery,
  signup,
  verifyRequestOrigin,
} from '@netlify/identity';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.userMetadata?.full_name || '',
  };
}

function credentials(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password) throw new Error('Email and password are required.');
  return { email, password };
}

export default async (request) => {
  try {
    if (request.method === 'GET') {
      return json({ user: safeUser(await getUser()) });
    }
    if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

    verifyRequestOrigin(request);
    const body = await request.json();
    const action = String(body?.action || '');

    if (action === 'login') {
      const { email, password } = credentials(body);
      return json({ user: safeUser(await login(email, password)) });
    }
    if (action === 'signup') {
      const { email, password } = credentials(body);
      await signup(email, password);
      return json({
        success: true,
        message: 'Account created. Check your email to confirm your address, then sign in.',
      });
    }
    if (action === 'logout') {
      await logout();
      return json({ success: true, user: null });
    }
    if (action === 'confirm') {
      const token = String(body?.token || '');
      if (!token) throw new Error('Confirmation token is missing.');
      return json({ user: safeUser(await confirmEmail(token)) });
    }
    if (action === 'accept-invite') {
      const token = String(body?.token || '');
      const password = String(body?.password || '');
      if (!token || !password) throw new Error('Invite token and password are required.');
      return json({ user: safeUser(await acceptInvite(token, password)) });
    }
    if (action === 'request-recovery') {
      const email = String(body?.email || '').trim().toLowerCase();
      if (!email) throw new Error('Email is required.');
      await requestPasswordRecovery(email);
      return json({ success: true, message: 'If that account exists, a password reset email is on the way.' });
    }
    if (action === 'recover') {
      const token = String(body?.token || '');
      const password = String(body?.password || '');
      if (!token || !password) throw new Error('Recovery token and new password are required.');
      return json({ user: safeUser(await recoverPassword(token, password)) });
    }

    return json({ error: 'Unknown authentication action.' }, 400);
  } catch (error) {
    console.error('Authentication API failed:', error);
    const status = Number(error?.status || error?.statusCode) || 400;
    return json({ error: error?.message || 'Authentication request failed.' }, status);
  }
};

export const config = { path: '/api/auth' };
