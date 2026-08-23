import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import {
  communityReportKey, createCommunityReport, deleteModerationBlock, listCommunityReports,
  moderationBlockKey, normalizeCommunityReportInput, readModerationBlock, writeModerationBlock,
} from '../netlify/functions/community-moderation-store.mjs';
import {
  buildPublicProjection, listPublicProjections, publicRecordKey, recordKey,
} from '../netlify/functions/dice-set-store.mjs';

function memoryStore() {
  const values = new Map();
  return {
    values,
    async get(key) { return values.get(key) ?? null; },
    async setJSON(key, value, options = {}) {
      if (options.onlyIfNew && values.has(key)) return { modified: false };
      values.set(key, structuredClone(value)); return { modified: true };
    },
    async delete(key) { values.delete(key); },
    list({ prefix, paginate = false }) {
      const blobs = [...values.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key }));
      if (paginate) return { async *[Symbol.asyncIterator]() { yield { blobs }; } };
      return Promise.resolve({ blobs });
    },
  };
}

try {
  const normalized = normalizeCommunityReportInput({
    publicAccessId: 'public_0123456789abcdef', reason: ' Privacy ', details: '  Contains private information.  ',
  });
  assert.deepEqual(normalized, {
    publicAccessId: 'public_0123456789abcdef', reason: 'privacy', details: 'Contains private information.',
  });
  assert.throws(() => normalizeCommunityReportInput({ publicAccessId: 'bad', reason: 'privacy' }), /invalid/i);
  assert.throws(() => normalizeCommunityReportInput({ publicAccessId: 'public_0123456789abcdef', reason: 'spam' }), /valid report reason/i);
  assert.throws(() => normalizeCommunityReportInput({ publicAccessId: 'public_0123456789abcdef', reason: 'other', details: 'x'.repeat(501) }), /500/);

  const reportKey = communityReportKey('public_0123456789abcdef', 'private_reporter_id');
  assert.equal(reportKey.includes('private_reporter_id'), false, 'Reporter account id must not appear in Blob keys.');
  const blockKey = moderationBlockKey('private_owner_id', 'private_set_id');
  assert.equal(blockKey.includes('private_owner_id'), false, 'Owner account id must not appear in moderation Blob keys.');
  assert.equal(blockKey.includes('private_set_id'), false, 'Private dice-set id must not appear in moderation Blob keys.');

  const store = memoryStore();
  const report = {
    schemaVersion: 1,
    publicAccessId: 'public_0123456789abcdef',
    ownerId: 'owner_internal', setId: 'set_internal', setName: 'Reported Set', reporterId: 'reporter_internal',
    reason: 'privacy', details: 'Contains private information.', createdAt: '2026-08-22T20:00:00.000Z',
  };
  assert.equal((await createCommunityReport(store, report)).created, true);
  assert.equal((await createCommunityReport(store, report)).created, false, 'Same account/set report must deduplicate.');
  assert.equal((await listCommunityReports(store)).length, 1);

  const source = createUserDiceSet({ id: report.setId, ownerId: report.ownerId, name: report.setName });
  source.locked = true; source.visibility = 'public';
  const ownerRecord = {
    set: source, publicAccessId: report.publicAccessId, recordVersion: 'record_v1',
    createdAt: '2026-08-22T19:00:00.000Z', updatedAt: '2026-08-22T20:00:00.000Z',
  };
  const projection = buildPublicProjection(ownerRecord, report.publicAccessId);
  store.values.set(recordKey(report.ownerId, report.setId), ownerRecord);
  store.values.set(publicRecordKey(report.publicAccessId), projection);
  assert.equal((await listPublicProjections(store)).length, 1, 'Unblocked current projection should be visible.');

  const block = {
    schemaVersion: 1, status: 'takedown', ownerId: report.ownerId, setId: report.setId,
    publicAccessId: report.publicAccessId, reason: 'privacy', adminId: 'admin_internal',
    createdAt: '2026-08-22T20:05:00.000Z', updatedAt: '2026-08-22T20:05:00.000Z',
  };
  await writeModerationBlock(store, block);
  assert.equal((await readModerationBlock(store, report.ownerId, report.setId))?.status, 'takedown');
  assert.equal((await listPublicProjections(store)).length, 0, 'Moderation block must hide a projection even when the projection Blob still exists.');
  await deleteModerationBlock(store, report.ownerId, report.setId);
  assert.equal(await readModerationBlock(store, report.ownerId, report.setId), null);
  assert.equal((await listPublicProjections(store)).length, 1, 'Lifting the block may restore an otherwise-current projection in the storage fixture.');

  const moderationSource = readFileSync(new URL('../netlify/functions/community-moderation.mjs', import.meta.url), 'utf8');
  const saveSource = readFileSync(new URL('../netlify/functions/save-dice-set.mjs', import.meta.url), 'utf8');
  const reportSource = readFileSync(new URL('../netlify/functions/community-report.mjs', import.meta.url), 'utf8');
  const studioSource = readFileSync(new URL('../js/appearance/studio-community-report.mjs', import.meta.url), 'utf8');
  const studioHtml = readFileSync(new URL('../customize.html', import.meta.url), 'utf8');
  const adminHtml = readFileSync(new URL('../moderation.html', import.meta.url), 'utf8');

  assert.match(moderationSource, /user\.roles\.includes\('admin'\)/, 'Admin endpoint must authorize from server-verified Identity roles.');
  assert.doesNotMatch(moderationSource, /reporterId/, 'Admin browser response must not expose reporter account ids.');
  assert.ok(
    moderationSource.indexOf('await writeModerationBlock') < moderationSource.indexOf('await store.delete(publicRecordKey(publicAccessId))'),
    'Takedown must persist the fail-closed block before best-effort projection cleanup.',
  );
  assert.match(saveSource, /community-publication-blocked/, 'Save path must reject republishing a moderated set.');
  assert.match(reportSource, /Sign in to report a Community dice set/, 'Report endpoint must require authentication.');
  assert.match(reportSource, /windowLimit: 10/, 'Report endpoint must have a low abuse rate limit.');
  assert.match(studioSource, /community-report-btn/, 'Dice Studio must add a user-facing Report control.');
  assert.match(studioHtml, /Community sets must be safe to share/, 'Community Acceptable Use rules must be visible before browsing public sets.');
  assert.match(studioHtml, /id="community-report-dialog"/, 'Dice Studio must ship the report dialog.');
  assert.match(adminHtml, /Community Moderation/, 'A browser moderation queue must ship for administrators.');

  console.log('Community moderation passed: reports deduplicate privately, moderation blocks fail closed, republishing is blocked, reporter ids stay server-side, and user/admin UI paths are present.');
} catch (error) {
  console.error('Community moderation check failed:', error);
  process.exitCode = 1;
}
