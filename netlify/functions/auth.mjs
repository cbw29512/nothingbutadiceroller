function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default async () => json({
  error: 'Legacy authentication API has been retired. Use the browser Identity flow.',
  code: 'legacy-auth-retired',
}, 410);

export const config = { path: '/api/auth' };
