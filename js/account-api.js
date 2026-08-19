export function getIdentity() {
  return window.netlifyIdentity || null;
}

async function getFreshToken(auth, user) {
  try {
    const refreshed = await auth.refresh();
    if (refreshed) return refreshed;
  } catch (error) {
    console.warn('Identity refresh failed; trying user JWT:', error);
  }

  return user.jwt();
}

export async function accountFetch(url, options = {}) {
  const auth = getIdentity();
  const user = auth?.currentUser();
  if (!auth || !user) throw new Error('Sign in to use saved dice.');

  const token = await getFreshToken(auth, user);
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
