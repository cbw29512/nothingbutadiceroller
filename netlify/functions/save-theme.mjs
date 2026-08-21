function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  return json({
    error: 'Legacy Theme Studio has been retired. Use Dice & Tray Studio instead.',
    code: 'legacy-theme-retired',
    path: '/customize.html',
  }, 410);
};

export const config = { path: '/api/save-theme' };
