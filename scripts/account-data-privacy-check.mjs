import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportAccountData } from '../netlify/functions/account-data-export.mjs';
import { deleteAccountData } from '../netlify/functions/account-data-delete.mjs';
import {
  COMMUNITY_MODERATION_PREFIX, COMMUNITY_REPORT_PREFIX, communityReportKey, moderationBlockKey,
} from '../netlify/functions/community-moderation-store.mjs';
import { publicRecordKey, recordKey } from '../netlify/functions/dice-set-store.mjs';
import {
  LEGACY_THEME_COMMUNITY_INDEX, legacyThemeIndexKey, legacyThemeKey,
} from '../netlify/functions/legacy-theme-store.mjs';
import { configurationKey, shortcutKey } from '../netlify/functions/user-data-store.mjs';

function memoryStore(initial = {}, { failDeleteOnce = new Set() } = {}) {
  const values = new Map();
  let revision = 0;
  for (const [key, value] of Object.entries(initial)) {
    revision += 1;
    values.set(key, { value: structuredClone(value), etag: `v${revision}` });
  }
  const failed = new Set();
  return {
    values,
    async get(key) { return values.has(key) ? structuredClone(values.get(key).value) : null; },
    async getWithMetadata(key) {
      const entry = values.get(key);
      return entry ? { data: structuredClone(entry.value), etag: entry.etag, metadata: {} } : null;
    },
    list({ prefix, paginate = false }) {
      const blobs = [...values.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key }));
      if (paginate) return { async *[Symbol.asyncIterator]() { yield { blobs }; } };
      return Promise.resolve({ blobs });
    },
    async setJSON(key, value, options = {}) {
      const current = values.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && current?.etag !== options.onlyIfMatch) return { modified: false };
      revision += 1;
      const etag = `v${revision}`;
      values.set(key, { value: structuredClone(value), etag });
      return { modified: true, etag };
    },
    async delete(key) {
      if (failDeleteOnce.has(key) && !failed.has(key)) {
        failed.add(key);
        throw new Error(`Injected delete failure for ${key}`);
      }
      values.delete(key);
    },
  };
}

function value(store, key) { return store.values.get(key)?.value ?? null; }

try {
  const userId = 'private_user_123';
  const otherUserId = 'other_user_456';
  const setId = 'set_private';
  const publicId = 'public_0123456789abcdef';
  const imageKey = `users/${encodeURIComponent(userId)}/dice-sets/${setId}_tray_secret`;
  const diceKey = recordKey(userId, setId);
  const legacyId = 'legacy_theme_1';
  const legacyImageKey = `users/${encodeURIComponent(userId)}/themes/${legacyId}_image_secret`;
  const authoredReportKey = communityReportKey('public_aaaaaaaaaaaaaaaa', userId);
  const ownedSetReportKey = `${COMMUNITY_REPORT_PREFIX}public_owned/owned-report.json`;
  const unrelatedReportKey = `${COMMUNITY_REPORT_PREFIX}public_other/unrelated.json`;
  const ownedBlockKey = moderationBlockKey(userId, setId);
  const adminBlockKey = moderationBlockKey(otherUserId, 'other_set');

  const configurationStore = memoryStore({
    [configurationKey(userId)]: [{
      id: 'cfg_1', name: 'Private Config', selectedDice: [{ type: 'd20' }], trayTheme: 'tray-green_felt',
      dieSkin: 'skin-ruby_red', keepDice: true, isDefault: true,
      customAppearance: {
        themeId: legacyId, ownerId: userId, name: 'Old Look', trayName: 'Old Tray', trayColor: '#112233',
        diceColor: '#445566', imageUrl: `/api/theme-image?owner=${userId}&token=secret-capability`,
        enableGlow: true, glowColor: '#00ff66', isPublic: false,
      },
    }],
  });
  const shortcutStore = memoryStore({
    [shortcutKey(userId)]: { schemaVersion: 1, revision: 2, updatedAt: '2026-08-22T00:00:00.000Z', shortcuts: [{ id: 's1', name: 'Sneak Attack' }], options: { preferredRuleset: '2024' } },
  });
  const appStore = memoryStore({
    [diceKey]: {
      set: {
        id: setId, ownerId: userId, name: 'Private Set', locked: true, visibility: 'public',
        appearance: { tray: { image: { kind: 'blob', url: `/api/dice-set-image?owner=${userId}&token=secret-image-capability` } } },
      },
      trayImageKey: imageKey,
      trayImageAccessToken: 'secret-image-capability',
      publicAccessId: publicId,
      createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-22T00:00:00.000Z',
    },
    [imageKey]: 'binary-placeholder',
    [publicRecordKey(publicId)]: { publicAccessId: publicId, ownerId: userId, setId },
    [legacyThemeIndexKey(userId)]: [{ ownerId: userId, themeId: legacyId }],
    [legacyThemeKey(userId, legacyId)]: {
      ownerId: userId, themeId: legacyId, themeName: 'Legacy Private', trayName: 'Old Tray', imageKey: legacyImageKey,
      imageAccessToken: 'legacy-secret-token', isPublic: true, customStyles: { baseColor: '#112233' },
    },
    [legacyImageKey]: 'legacy-image-placeholder',
    [LEGACY_THEME_COMMUNITY_INDEX]: [{ ownerId: userId, themeId: legacyId }, { ownerId: otherUserId, themeId: 'other_theme' }],
    [authoredReportKey]: {
      reporterId: userId, ownerId: otherUserId, setId: 'other_set', publicAccessId: 'public_aaaaaaaaaaaaaaaa',
      setName: 'Other Set', reason: 'privacy', details: 'My authored report', createdAt: '2026-08-22T01:00:00.000Z',
    },
    [ownedSetReportKey]: { reporterId: otherUserId, ownerId: userId, setId, publicAccessId: publicId, reason: 'other' },
    [unrelatedReportKey]: { reporterId: otherUserId, ownerId: otherUserId, setId: 'other_set', publicAccessId: 'public_bbbbbbbbbbbbbbbb', reason: 'other' },
    [ownedBlockKey]: { ownerId: userId, setId, publicAccessId: publicId, status: 'takedown', adminId: otherUserId, reason: 'privacy' },
    [adminBlockKey]: { ownerId: otherUserId, setId: 'other_set', publicAccessId: 'public_bbbbbbbbbbbbbbbb', status: 'takedown', adminId: userId, reason: 'other' },
  }, { failDeleteOnce: new Set([imageKey]) });

  const stores = { configurationStore, shortcutStore, appStore, legacyStore: appStore };
  const exported = await exportAccountData(userId, {}, stores);
  assert.equal(exported.savedConfigurations[0].name, 'Private Config');
  assert.equal(exported.diceSets[0].set.name, 'Private Set');
  assert.equal(exported.diceSets[0].hadTrayImage, true);
  assert.equal(exported.diceSets[0].set.ownerId, undefined);
  assert.equal(exported.diceSets[0].set.appearance.tray.image, null);
  assert.equal(exported.legacyThemes[0].hadServerImage, true);
  assert.equal(exported.authoredCommunityReports[0].details, 'My authored report');
  const serializedExport = JSON.stringify(exported);
  for (const secret of [userId, 'secret-capability', 'secret-image-capability', imageKey, legacyImageKey, 'legacy-secret-token']) {
    assert.equal(serializedExport.includes(secret), false, `Export must omit capability/storage detail: ${secret}`);
  }
  assert.match(exported.scope, /sign-in account and browser-local data are not included/i);

  await assert.rejects(
    () => deleteAccountData(userId, {}, stores),
    /did not fully complete/i,
    'Injected child cleanup failure must surface instead of falsely reporting success.',
  );
  const tombstone = value(appStore, diceKey);
  assert.equal(tombstone?.deletionMarker, true, 'Owner record must remain as a retryable deletion tombstone.');
  assert.equal(tombstone?.set, undefined, 'Deletion tombstone must not retain the user dice-set payload.');
  assert.equal(value(appStore, publicRecordKey(publicId)), null, 'Public projection must already be revoked before child cleanup failure returns.');
  assert.notEqual(value(appStore, imageKey), null, 'Injected image cleanup failure should leave the referenced image for retry.');

  const deleted = await deleteAccountData(userId, {}, stores);
  assert.equal(deleted.success, true);
  assert.equal(deleted.signInAccountDeleted, false);
  assert.equal(deleted.browserLocalDataDeleted, false);
  for (const key of [
    diceKey, imageKey, publicRecordKey(publicId), legacyThemeIndexKey(userId), legacyThemeKey(userId, legacyId),
    legacyImageKey, authoredReportKey, ownedSetReportKey, ownedBlockKey, configurationKey(userId), shortcutKey(userId),
  ]) assert.equal(value(key.includes('configurations') ? configurationStore : key.includes('shortcuts-v1') ? shortcutStore : appStore, key), null, `Expected deleted cloud key: ${key}`);
  assert.notEqual(value(appStore, unrelatedReportKey), null, 'Unrelated Community report must remain.');
  assert.equal(value(appStore, adminBlockKey)?.adminId, 'deleted-administrator', 'Admin identity references must be anonymized without lifting unrelated moderation.');
  assert.equal(value(appStore, LEGACY_THEME_COMMUNITY_INDEX).some((item) => item.ownerId === userId), false, 'Legacy Community index must not retain deleted owner id.');
  assert.equal(value(appStore, LEGACY_THEME_COMMUNITY_INDEX).some((item) => item.ownerId === otherUserId), true, 'Unrelated legacy Community entries must remain.');

  const endpoint = await readFile(new URL('../netlify/functions/account-data.mjs', import.meta.url), 'utf8');
  const saveApi = await readFile(new URL('../netlify/functions/save-dice-set.mjs', import.meta.url), 'utf8');
  for (const text of [
    'const user = await getUser()', 'verifyRequestOrigin(request)', "DELETE_CONFIRMATION = 'DELETE MY CLOUD DATA'",
    "path: '/api/account-data'", 'Content-Disposition', 'exportAccountData(user.id, context)', 'deleteAccountData(user.id, context)',
  ]) assert.ok(endpoint.includes(text), `Account data endpoint contract missing: ${text}`);
  assert.ok(!endpoint.includes('deleteUser'), 'Application-data deletion must not silently delete the Netlify Identity account.');
  assert.ok(saveApi.includes("code: 'dice-set-deleting'"), 'Racing Dice Studio saves must not resurrect privacy-deletion tombstones.');
  assert.ok(saveApi.indexOf('current?.record?.deletionMarker') < saveApi.indexOf('version !== (current?.version || null)'), 'Deletion marker must be handled before normal version conflict serialization.');

  console.log('Account privacy lifecycle passed: export omits capabilities, cloud deletion is fail-closed/retryable, all user app stores are removed, unrelated data remains, admin references anonymize, and the sign-in account/browser data remain untouched.');
} catch (error) {
  console.error('Account privacy lifecycle check failed:', error);
  process.exitCode = 1;
}
