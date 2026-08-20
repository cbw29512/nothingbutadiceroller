import { createUserDiceSet } from './schema.mjs';

const HEX = /^#[0-9a-f]{6}$/i;

function color(value, fallback) {
  return HEX.test(String(value || '')) ? String(value) : fallback;
}

function safeLegacyImageUrl(value) {
  const url = String(value || '');
  return url.startsWith('/api/theme-image?') || url.startsWith('/.netlify/blobs/') ? url : null;
}

export function migrateLegacyTheme(legacy, { ownerId, fallbackId } = {}) {
  try {
    if (!legacy || typeof legacy !== 'object') throw new Error('Legacy theme is required.');
    const styles = legacy.customStyles || {};
    const set = createUserDiceSet({
      id: legacy.themeId || fallbackId,
      ownerId: legacy.ownerId || ownerId,
      name: legacy.themeName || legacy.name || 'Imported Dice Set',
    });

    const appearance = set.appearance;
    appearance.diceSet.defaultStyle.bodyColor = color(
      styles.diceColor || legacy.diceColor,
      '#b91c1c',
    );
    appearance.diceSet.defaultStyle.faceColor = color(styles.numberColor, '#ffffff');
    appearance.diceSet.defaultStyle.opacity = Math.max(0.25, Math.min(1, Number(styles.opacity) || 1));

    const glowEnabled = Boolean(styles.enableGlow ?? legacy.enableGlow);
    const glowColor = color(styles.glowColor || legacy.glowColor, '#ffffff');
    appearance.diceSet.defaultStyle.glow = { enabled: false, color: glowColor, intensity: 0 };
    appearance.tray.color = color(styles.baseColor || legacy.trayColor, '#000000');
    appearance.tray.glow = { enabled: glowEnabled, color: glowColor, intensity: glowEnabled ? 0.7 : 0 };

    const imageUrl = safeLegacyImageUrl(legacy.imageUrl);
    appearance.tray.image = imageUrl
      ? { assetId: null, legacyUrl: imageUrl, fit: 'cover', opacity: 1 }
      : null;

    set.locked = Boolean(legacy.isPublic);
    set.visibility = legacy.isPublic ? 'public' : 'private';
    return set;
  } catch (error) {
    console.error('Failed to migrate legacy theme:', error);
    throw error;
  }
}
