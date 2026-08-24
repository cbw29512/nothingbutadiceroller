import {
  COMMUNITY_MODERATION_PREFIX, COMMUNITY_REPORT_PREFIX, moderationBlockKey,
} from './community-moderation-store.mjs';
import { readVersionedRecord } from './dice-set-concurrency.mjs';
import {
  openDiceSetStore, publicRecordKey, userDiceSetPrefix,
} from './dice-set-store.mjs';
import {
  LEGACY_THEME_COMMUNITY_INDEX, legacyThemeIndexKey, legacyThemePrefix,
  openLegacyThemeStore, readLegacyCommunityIndex,
} from './legacy-theme-store.mjs';
import { deleteBlob, listAllBlobKeys, readJsonEntries } from './privacy-store-utils.mjs';
import {
  configurationKey, openConfigurationStore, openShortcutStore, shortcutKey,
} from './user-data-store.mjs';

const MAX_DICE_DELETE_RETRIES = 4;

function diceRecordKeys(store, userId) {
  const prefix = userDiceSetPrefix(userId);
  return listAllBlobKeys(store, prefix).then((keys) => keys.filter((key) => key.endsWith('.json') && key !== `${prefix}index.json`));
}

async function markDiceRecordDeleting(store, key, userId) {
  for (let attempt = 0; attempt < MAX_DICE_DELETE_RETRIES; attempt += 1) {
    const current = await readVersionedRecord(store, key);
    if (!current) return null;
    if (current.record?.deletionMarker) return current.record;
    const record = current.record;
    if (!record?.set || record.set.ownerId !== userId) throw new Error('Dice-set deletion ownership validation failed.');
    const tombstone = {
      deletionMarker: true,
      deletedAt: new Date().toISOString(),
      cleanup: {
        setId: record.set.id,
        publicAccessId: record.publicAccessId || null,
        trayImageKey: record.trayImageKey || null,
      },
    };
    const result = await store.setJSON(key, tombstone, { onlyIfMatch: current.version });
    if (result?.modified) return tombstone;
  }
  throw new Error('Dice set kept changing while cloud deletion was requested. Close other editing sessions and retry.');
}

async function finishDiceRecordDeletion(store, key, tombstone, userId) {
  const cleanup = tombstone?.cleanup || {};
  if (cleanup.publicAccessId) {
    await deleteBlob(store, publicRecordKey(cleanup.publicAccessId), 'public dice-set projection');
  }
  if (cleanup.trayImageKey) await deleteBlob(store, cleanup.trayImageKey, 'tray image');
  if (cleanup.setId) {
    await deleteBlob(store, moderationBlockKey(userId, cleanup.setId), 'dice-set moderation block');
  }
  await deleteBlob(store, key, 'dice-set owner record');
}

async function deleteDiceSets(store, userId) {
  const keys = await diceRecordKeys(store, userId);
  let deleted = 0;
  for (const key of keys) {
    const tombstone = await markDiceRecordDeleting(store, key, userId);
    if (!tombstone) continue;
    await finishDiceRecordDeletion(store, key, tombstone, userId);
    deleted += 1;
  }
  return deleted;
}

async function markLegacyThemeDeleting(store, themeKey, theme) {
  if (theme?.deletionMarker) return theme;
  const tombstone = {
    ...theme,
    isPublic: false,
    deletionMarker: true,
    deletedAt: new Date().toISOString(),
  };
  await store.setJSON(themeKey, tombstone);
  return tombstone;
}

async function deleteLegacyThemes(store, userId) {
  const prefix = legacyThemePrefix(userId);
  const indexKey = legacyThemeIndexKey(userId);
  const allKeys = await listAllBlobKeys(store, prefix);
  const themeRecordKeys = allKeys.filter((key) => key.endsWith('.json') && key !== indexKey);
  let deleted = 0;

  for (const key of themeRecordKeys) {
    const theme = await store.get(key, { type: 'json' }).catch(() => null);
    if (!theme) {
      await deleteBlob(store, key, 'unreadable legacy theme record');
      continue;
    }
    const tombstone = await markLegacyThemeDeleting(store, key, theme);
    if (tombstone.imageKey) await deleteBlob(store, tombstone.imageKey, 'legacy theme image');
    await deleteBlob(store, key, 'legacy theme record');
    deleted += 1;
  }

  // The index is not authoritative for privacy deletion. Sweep the entire user-owned
  // legacy prefix so stale index entries or orphan image blobs cannot survive.
  const remainingKeys = await listAllBlobKeys(store, prefix);
  for (const key of remainingKeys) await deleteBlob(store, key, 'legacy theme orphan');

  const community = await readLegacyCommunityIndex(store);
  const nextCommunity = community.filter((item) => item?.ownerId !== userId);
  if (nextCommunity.length !== community.length) {
    await store.setJSON(LEGACY_THEME_COMMUNITY_INDEX, nextCommunity);
  }
  return deleted;
}

async function deleteCommunityPrivacyData(store, userId) {
  const reports = await readJsonEntries(store, COMMUNITY_REPORT_PREFIX);
  let reportsDeleted = 0;
  for (const entry of reports) {
    if (entry.value?.reporterId !== userId && entry.value?.ownerId !== userId) continue;
    await deleteBlob(store, entry.key, 'Community report');
    reportsDeleted += 1;
  }

  const blocks = await readJsonEntries(store, COMMUNITY_MODERATION_PREFIX);
  let blocksDeleted = 0;
  let adminReferencesAnonymized = 0;
  for (const entry of blocks) {
    const block = entry.value;
    if (block?.ownerId === userId) {
      await deleteBlob(store, entry.key, 'Community moderation block');
      blocksDeleted += 1;
      continue;
    }
    if (block?.adminId === userId) {
      await store.setJSON(entry.key, {
        ...block,
        adminId: 'deleted-administrator',
        adminIdentityRemovedAt: new Date().toISOString(),
      });
      adminReferencesAnonymized += 1;
    }
  }
  return { reportsDeleted, blocksDeleted, adminReferencesAnonymized };
}

export async function deleteAccountData(userId, context, stores = {}) {
  try {
    const configurationStore = stores.configurationStore || openConfigurationStore(context);
    const shortcutStore = stores.shortcutStore || openShortcutStore(context);
    const appStore = stores.appStore || openDiceSetStore(context);
    const legacyStore = stores.legacyStore || openLegacyThemeStore(context);

    const diceSetsDeleted = await deleteDiceSets(appStore, userId);
    const legacyThemesDeleted = await deleteLegacyThemes(legacyStore, userId);
    const moderation = await deleteCommunityPrivacyData(appStore, userId);
    const configurationDeleted = await deleteBlob(configurationStore, configurationKey(userId), 'saved configurations');
    const shortcutsDeleted = await deleteBlob(shortcutStore, shortcutKey(userId), 'shortcut workspace');

    return {
      success: true,
      diceSetsDeleted,
      legacyThemesDeleted,
      savedConfigurationsDeleted: configurationDeleted,
      shortcutWorkspaceDeleted: shortcutsDeleted,
      ...moderation,
      signInAccountDeleted: false,
      browserLocalDataDeleted: false,
    };
  } catch (error) {
    console.error('Account cloud data deletion failed:', error);
    throw new Error('Cloud data deletion did not fully complete. Public dice-set revocation remains fail-closed; retry the deletion to finish cleanup.');
  }
}
