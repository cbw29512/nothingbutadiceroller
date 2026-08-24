import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { apiErrorResponse, publicError } from './api-errors.mjs';
import { deleteAccountData } from './account-data-delete.mjs';
import { exportAccountData } from './account-data-export.mjs';

const DELETE_CONFIRMATION = 'DELETE MY CLOUD DATA';

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
      ...headers,
    },
  });
}

async function requestJson(request) {
  try { return await request.json(); }
  catch { throw publicError('Request body must be valid JSON.', { code: 'invalid-json' }); }
}

export default async (request, context) => {
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Authentication required.', code: 'authentication-required' }, 401);

    if (request.method === 'GET') {
      const data = await exportAccountData(user.id, context);
      return json(data, 200, {
        'Content-Disposition': 'attachment; filename="nothing-but-a-dice-roller-data.json"',
      });
    }

    if (request.method === 'DELETE') {
      verifyRequestOrigin(request);
      const body = await requestJson(request);
      if (body?.confirmation !== DELETE_CONFIRMATION) {
        throw publicError(`Type “${DELETE_CONFIRMATION}” to confirm server-side app-data deletion.`, {
          code: 'cloud-data-deletion-confirmation-required',
        });
      }
      return json(await deleteAccountData(user.id, context));
    }

    return json({ error: 'Method Not Allowed', code: 'method-not-allowed' }, 405);
  } catch (error) {
    if (error?.name !== 'PublicApiError') console.error('Account data request failed:', error);
    const safe = apiErrorResponse(error, 'Account data request failed.');
    return json(safe.body, safe.status);
  }
};

export const config = {
  path: '/api/account-data',
  rateLimit: {
    windowLimit: 12,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
