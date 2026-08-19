import { getUser } from '@netlify/identity';

export default async () => {
  try {
    const user = await getUser();
    if (!user) {
      return Response.json({ user: null }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.userMetadata?.fullName || user.user_metadata?.full_name || '',
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Account status failed:', error);
    return Response.json({ error: 'Unable to read account.' }, { status: 500 });
  }
};

export const config = {
  path: '/api/me',
};
