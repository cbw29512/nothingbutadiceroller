import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { apiErrorResponse, publicError } from './api-errors.mjs';
import {
  deleteModerationBlock, listCommunityReports, readModerationBlock, writeModerationBlock,
} from './community-moderation-store.mjs';
import { openDiceSetStore, publicRecordKey, recordKey } from './dice-set-store.mjs';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function requireAdmin(user) {
  if (!user) throw publicError('Authentication required.', { status: 401, code: 'authentication-required' });
  if (!Array.isArray(user.roles) || !user.roles.includes('admin')) {
    throw publicError('Administrator access required.', { status: 403, code: 'admin-required' });
  }
}
async function requestJson(request) {
  try { return await request.json(); }
  catch { throw publicError('Request body must be valid JSON.', { code: 'invalid-json' }); }
}
function requiredId(value, label) {
  const id = String(value || '').trim();
  if (!id || id.length > 128) throw publicError(`${label} is invalid.`, { code: 'invalid-moderation-target' });
  return id;
}
function optionalReason(value) {
  const reason = String(value || '').trim();
  if (reason.length > 300) throw publicError('Moderation reason must be 300 characters or fewer.', { code: 'invalid-moderation-reason' });
  return reason;
}
async function reportQueue(store) {
  const reports = await listCommunityReports(store);
  return Promise.all(reports.map(async (report) => ({
    publicAccessId: report.publicAccessId,
    ownerId: report.ownerId,
    setId: report.setId,
    setName: report.setName,
    reason: report.reason,
    details: report.details,
    createdAt: report.createdAt,
    blocked: Boolean(await readModerationBlock(store, report.ownerId, report.setId)),
  })));
}
async function takedown(store, user, body) {
  const ownerId = requiredId(body.ownerId, 'Owner id');
  const setId = requiredId(body.setId, 'Dice-set id');
  const publicAccessId = requiredId(body.publicAccessId, 'Community dice-set id');
  const ownerRecord = await store.get(recordKey(ownerId, setId), { type: 'json' }).catch(() => null);
  if (!ownerRecord?.set || ownerRecord.set.ownerId !== ownerId || ownerRecord.set.id !== setId) {
    throw publicError('The reported dice set no longer exists.', { status: 404, code: 'moderation-target-not-found' });
  }
  if (ownerRecord.publicAccessId && ownerRecord.publicAccessId !== publicAccessId) {
    throw publicError('The report no longer matches the current publication.', { status: 409, code: 'stale-moderation-target' });
  }
  const now = new Date().toISOString();
  const existing = await readModerationBlock(store, ownerId, setId);
  const block = {
    schemaVersion: 1,
    status: 'takedown',
    ownerId,
    setId,
    publicAccessId,
    reason: optionalReason(body.reason),
    adminId: user.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await writeModerationBlock(store, block);
  try { await store.delete(publicRecordKey(publicAccessId)); }
  catch (error) { console.warn('Community projection cleanup failed after fail-closed moderation block:', error); }
  return { success: true, blocked: true };
}
async function liftBlock(store, body) {
  const ownerId = requiredId(body.ownerId, 'Owner id');
  const setId = requiredId(body.setId, 'Dice-set id');
  const block = await readModerationBlock(store, ownerId, setId);
  if (!block) return { success: true, blocked: false, republishRequired: true };
  const publicAccessId = requiredId(block.publicAccessId, 'Community dice-set id');
  try {
    await store.delete(publicRecordKey(publicAccessId));
  } catch (error) {
    console.error('Failed to clear public projection before lifting moderation block:', error);
    throw new Error('Unable to safely lift Community moderation block.');
  }
  await deleteModerationBlock(store, ownerId, setId);
  return { success: true, blocked: false, republishRequired: true };
}

export default async (request, context) => {
  try {
    const user = await getUser();
    requireAdmin(user);
    const store = openDiceSetStore(context);
    if (request.method === 'GET') return json({ reports: await reportQueue(store) });
    if (request.method === 'POST') {
      verifyRequestOrigin(request);
      const body = await requestJson(request);
      const action = String(body.action || '').trim();
      if (action === 'takedown') return json(await takedown(store, user, body));
      if (action === 'lift') return json(await liftBlock(store, body));
      throw publicError('Moderation action is invalid.', { code: 'invalid-moderation-action' });
    }
    return json({ error: 'Method Not Allowed', code: 'method-not-allowed' }, 405);
  } catch (error) {
    if (error?.name !== 'PublicApiError') console.error('Community moderation request failed:', error);
    const safe = apiErrorResponse(error, 'Community moderation request failed.');
    return json(safe.body, safe.status);
  }
};

export const config = {
  path: '/api/community-moderation',
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
