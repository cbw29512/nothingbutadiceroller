import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { apiErrorResponse, publicError } from './api-errors.mjs';
import { createCommunityReport, normalizeCommunityReportInput } from './community-moderation-store.mjs';
import { openDiceSetStore, resolvePublicProjection } from './dice-set-store.mjs';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
async function requestJson(request) {
  try { return await request.json(); }
  catch { throw publicError('Request body must be valid JSON.', { code: 'invalid-json' }); }
}
function reportInput(body) {
  try { return normalizeCommunityReportInput(body); }
  catch (error) { throw publicError(error?.message || 'Community report is invalid.', { code: 'invalid-community-report' }); }
}

export default async (request, context) => {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed', code: 'method-not-allowed' }, 405);
  try {
    const user = await getUser();
    if (!user) return json({ error: 'Sign in to report a Community dice set.', code: 'authentication-required' }, 401);
    verifyRequestOrigin(request);
    const input = reportInput(await requestJson(request));
    const store = openDiceSetStore(context);
    const projection = await resolvePublicProjection(store, input.publicAccessId);
    if (!projection?.ownerId || !projection?.setId) {
      return json({ error: 'This Community dice set is no longer available.', code: 'community-set-not-found' }, 404);
    }
    const report = {
      schemaVersion: 1,
      publicAccessId: input.publicAccessId,
      ownerId: projection.ownerId,
      setId: projection.setId,
      setName: String(projection.publicRecord?.set?.name || 'Community Dice Set').slice(0, 80),
      reporterId: user.id,
      reason: input.reason,
      details: input.details,
      createdAt: new Date().toISOString(),
    };
    const result = await createCommunityReport(store, report);
    return json({ success: true, duplicate: !result.created }, result.created ? 201 : 200);
  } catch (error) {
    if (error?.name !== 'PublicApiError') console.error('Community report request failed:', error);
    const safe = apiErrorResponse(error, 'Unable to submit Community report.');
    return json(safe.body, safe.status);
  }
};

export const config = {
  path: '/api/community-report',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
