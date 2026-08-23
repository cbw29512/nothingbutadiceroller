import { createHash } from 'node:crypto';
import { openScopedStore } from './deploy-store.mjs';

export const LEGACY_THEME_STORE_NAME = 'dice-trays-store';
export const LEGACY_THEME_COMMUNITY_INDEX = 'community/themes/index.json';

export function legacyThemePrefix(ownerId) {
  return `users/${encodeURIComponent(String(ownerId))}/themes/`;
}
export function legacyThemeKey(ownerId, themeId) {
  return `${legacyThemePrefix(ownerId)}${encodeURIComponent(String(themeId))}.json`;
}
export function legacyThemeIndexKey(ownerId) {
  return `${legacyThemePrefix(ownerId)}index.json`;
}
export function openLegacyThemeStore(context) {
  return openScopedStore(LEGACY_THEME_STORE_NAME, context);
}
export function legacyPublicThemeId(ownerId, themeId) {
  const hash = createHash('sha256').update(`${ownerId}\u0000${themeId}`).digest('hex').slice(0, 32);
  return `public_theme_${hash}`;
}
function hex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
}
export function toPublicLegacyTheme(theme) {
  if (!theme?.isPublic || !theme?.ownerId || !theme?.themeId) return null;
  const publicId = legacyPublicThemeId(theme.ownerId, theme.themeId);
  const styles = theme.customStyles || {};
  return {
    themeId: publicId,
    ownerId: `community_${publicId}`,
    themeName: String(theme.themeName || 'Legacy Theme').slice(0, 80),
    trayName: String(theme.trayName || 'Custom Tray').slice(0, 80),
    creator: 'Adventurer',
    customStyles: {
      baseColor: hex(styles.baseColor, '#0f172a'),
      numberColor: hex(styles.numberColor, '#f8fafc'),
      diceColor: hex(styles.diceColor, '#b91c1c'),
      glowColor: hex(styles.glowColor, '#00ff66'),
      opacity: Math.max(0.25, Math.min(1, Number(styles.opacity) || 1)),
      enableGlow: Boolean(styles.enableGlow),
      customFaces: {},
    },
    imageUrl: theme.imageKey && theme.imageAccessToken
      ? `/api/theme-image?public=${encodeURIComponent(publicId)}&token=${theme.imageAccessToken}`
      : null,
    isPublic: true,
    createdAt: theme.createdAt || null,
    updatedAt: theme.updatedAt || null,
  };
}
export async function readLegacyCommunityIndex(store) {
  const value = await store.get(LEGACY_THEME_COMMUNITY_INDEX, { type: 'json' }).catch(() => []);
  return Array.isArray(value) ? value : [];
}
export async function resolveLegacyPublicTheme(store, publicId) {
  try {
    const index = await readLegacyCommunityIndex(store);
    for (const item of index) {
      if (!item?.ownerId || !item?.themeId) continue;
      if (legacyPublicThemeId(item.ownerId, item.themeId) !== publicId) continue;
      const theme = await store.get(legacyThemeKey(item.ownerId, item.themeId), { type: 'json' }).catch(() => null);
      return theme?.isPublic ? theme : null;
    }
    return null;
  } catch (error) {
    console.error('Failed to resolve legacy public theme:', error);
    return null;
  }
}
