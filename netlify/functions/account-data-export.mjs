import { readVersionedConfigurations } from './configuration-concurrency.mjs';
import {
  COMMUNITY_MODERATION_PREFIX, COMMUNITY_REPORT_PREFIX,
} from './community-moderation-store.mjs';
import { listVersionedUserRecords } from './dice-set-concurrency.mjs';
import { openDiceSetStore } from './dice-set-store.mjs';
import {
  legacyThemeIndexKey, legacyThemeKey, openLegacyThemeStore,
} from './legacy-theme-store.mjs';
import { readJsonEntries } from './privacy-store-utils.mjs';
import {
  configurationKey, openConfigurationStore, openShortcutStore, shortcutKey,
} from './user-data-store.mjs';

function safeConfiguration(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const custom = raw.customAppearance && typeof raw.customAppearance === 'object'
    ? {
      themeId: raw.customAppearance.themeId || null,
      name: raw.customAppearance.name || null,
      trayName: raw.customAppearance.trayName || null,
      trayColor: raw.customAppearance.trayColor || null,
      diceColor: raw.customAppearance.diceColor || null,
      enableGlow: Boolean(raw.customAppearance.enableGlow),
      glowColor: raw.customAppearance.glowColor || null,
      isPublic: Boolean(raw.customAppearance.isPublic),
      hadServerImage: Boolean(raw.customAppearance.imageUrl),
    }
    : null;
  return {
    id: raw.id || null,
    name: raw.name || null,
    selectedDice: Array.isArray(raw.selectedDice) ? structuredClone(raw.selectedDice) : [],
    trayTheme: raw.trayTheme || null,
    dieSkin: raw.dieSkin || null,
    customAppearance: custom,
    keepDice: Boolean(raw.keepDice),
    isDefault: Boolean(raw.isDefault),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

function safeDiceSet(record) {
  if (!record?.set || record.deletionMarker) return null;
  const set = structuredClone(record.set);
  delete set.ownerId;
  if (set?.appearance?.tray) set.appearance.tray.image = null;
  return {
    set,
    hadTrayImage: Boolean(record.trayImageKey),
    wasPublic: record.set.visibility === 'public',
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

function safeLegacyTheme(theme) {
  if (!theme || theme.deletionMarker) return null;
  return {
    themeId: theme.themeId || null,
    themeName: theme.themeName || null,
    trayName: theme.trayName || null,
    customStyles: theme.customStyles ? structuredClone(theme.customStyles) : null,
    isPublic: Boolean(theme.isPublic),
    hadServerImage: Boolean(theme.imageKey),
    createdAt: theme.createdAt || null,
    updatedAt: theme.updatedAt || null,
  };
}

function safeShortcutWorkspace(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    schemaVersion: raw.schemaVersion ?? null,
    revision: raw.revision ?? null,
    updatedAt: raw.updatedAt || null,
    shortcuts: Array.isArray(raw.shortcuts) ? structuredClone(raw.shortcuts) : [],
    options: raw.options && typeof raw.options === 'object' ? structuredClone(raw.options) : {},
  };
}

async function legacyThemesForUser(store, userId) {
  const index = await store.get(legacyThemeIndexKey(userId), { type: 'json' }).catch(() => []);
  if (!Array.isArray(index)) return [];
  const themes = await Promise.all(index.map((item) => (
    item?.themeId ? store.get(legacyThemeKey(userId, item.themeId), { type: 'json' }).catch(() => null) : null
  )));
  return themes.map(safeLegacyTheme).filter(Boolean);
}

async function authoredReports(store, userId) {
  const entries = await readJsonEntries(store, COMMUNITY_REPORT_PREFIX);
  return entries
    .map((entry) => entry.value)
    .filter((report) => report?.reporterId === userId)
    .map((report) => ({
      publicAccessId: report.publicAccessId || null,
      setName: report.setName || null,
      reason: report.reason || null,
      details: report.details || '',
      createdAt: report.createdAt || null,
    }));
}

async function moderationForOwnedSets(store, userId) {
  const entries = await readJsonEntries(store, COMMUNITY_MODERATION_PREFIX);
  return entries
    .map((entry) => entry.value)
    .filter((block) => block?.ownerId === userId)
    .map((block) => ({
      status: block.status || null,
      publicAccessId: block.publicAccessId || null,
      reason: block.reason || '',
      createdAt: block.createdAt || null,
      updatedAt: block.updatedAt || null,
    }));
}

export async function exportAccountData(userId, context, stores = {}) {
  try {
    const configurationStore = stores.configurationStore || openConfigurationStore(context);
    const shortcutStore = stores.shortcutStore || openShortcutStore(context);
    const appStore = stores.appStore || openDiceSetStore(context);
    const legacyStore = stores.legacyStore || openLegacyThemeStore(context);
    const [configSnapshot, shortcutRaw, diceEntries, legacyThemes, reports, moderation] = await Promise.all([
      readVersionedConfigurations(configurationStore, configurationKey(userId)),
      shortcutStore.get(shortcutKey(userId), { type: 'json' }).catch(() => null),
      listVersionedUserRecords(appStore, userId),
      legacyThemesForUser(legacyStore, userId),
      authoredReports(appStore, userId),
      moderationForOwnedSets(appStore, userId),
    ]);

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      scope: 'server-stored application data only; sign-in account and browser-local data are not included',
      savedConfigurations: configSnapshot.configurations.map(safeConfiguration).filter(Boolean),
      shortcuts: safeShortcutWorkspace(shortcutRaw),
      diceSets: diceEntries.map((entry) => safeDiceSet(entry.record)).filter(Boolean),
      legacyThemes,
      authoredCommunityReports: reports,
      moderationOnOwnedSets: moderation,
      omittedForSecurity: ['server storage keys', 'image capability tokens', 'raw uploaded image bytes'],
    };
  } catch (error) {
    console.error('Account data export failed:', error);
    throw new Error('Unable to prepare account data export.');
  }
}
