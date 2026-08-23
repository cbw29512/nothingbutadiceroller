import { createHash } from 'node:crypto';

export const COMMUNITY_REPORT_PREFIX = 'community/reports/';
export const COMMUNITY_MODERATION_PREFIX = 'community/moderation/';
export const MAX_MODERATION_REPORTS = 100;
export const REPORT_REASONS = new Set(['inappropriate', 'harassment', 'copyright', 'privacy', 'malicious', 'other']);

function digest(...parts) {
  try {
    return createHash('sha256').update(parts.join('\u0000')).digest('hex');
  } catch (error) {
    console.error('Failed to hash Community moderation key:', error);
    throw error;
  }
}
function normalizePublicAccessId(value) {
  const id = String(value || '').trim();
  if (!/^public_[A-Za-z0-9_-]{8,96}$/.test(id)) throw new Error('Community dice-set id is invalid.');
  return id;
}
export function communityReportKey(publicAccessId, reporterId) {
  const id = normalizePublicAccessId(publicAccessId);
  return `${COMMUNITY_REPORT_PREFIX}${encodeURIComponent(id)}/${digest(id, reporterId)}.json`;
}
export function moderationBlockKey(ownerId, setId) {
  return `${COMMUNITY_MODERATION_PREFIX}${digest(ownerId, setId)}.json`;
}
export function normalizeCommunityReportInput(input = {}) {
  try {
    const publicAccessId = normalizePublicAccessId(input.publicAccessId);
    const reason = String(input.reason || '').trim().toLowerCase();
    if (!REPORT_REASONS.has(reason)) throw new Error('Choose a valid report reason.');
    const details = String(input.details || '').trim();
    if (details.length > 500) throw new Error('Report details must be 500 characters or fewer.');
    return { publicAccessId, reason, details };
  } catch (error) {
    console.error('Failed to validate Community report:', error);
    throw error;
  }
}
export async function createCommunityReport(store, report) {
  try {
    const result = await store.setJSON(communityReportKey(report.publicAccessId, report.reporterId), report, { onlyIfNew: true });
    return { created: result?.modified !== false };
  } catch (error) {
    console.error('Failed to persist Community report:', error);
    throw error;
  }
}
export async function readModerationBlock(store, ownerId, setId) {
  try {
    return await store.get(moderationBlockKey(ownerId, setId), { type: 'json' }).catch(() => null);
  } catch (error) {
    console.error('Failed to read Community moderation block:', error);
    throw error;
  }
}
export async function writeModerationBlock(store, block) {
  try {
    await store.setJSON(moderationBlockKey(block.ownerId, block.setId), block);
    return block;
  } catch (error) {
    console.error('Failed to write Community moderation block:', error);
    throw error;
  }
}
export async function deleteModerationBlock(store, ownerId, setId) {
  try {
    await store.delete(moderationBlockKey(ownerId, setId));
    return true;
  } catch (error) {
    console.error('Failed to delete Community moderation block:', error);
    throw error;
  }
}
export async function listCommunityReports(store, maxReports = MAX_MODERATION_REPORTS) {
  try {
    for await (const page of store.list({ prefix: COMMUNITY_REPORT_PREFIX, paginate: true })) {
      const keys = (page?.blobs || []).map((entry) => entry?.key).filter(Boolean).slice(0, maxReports);
      const reports = await Promise.all(keys.map((key) => store.get(key, { type: 'json' }).catch(() => null)));
      return reports.filter(Boolean).sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    }
    return [];
  } catch (error) {
    console.error('Failed to list Community reports:', error);
    throw error;
  }
}
