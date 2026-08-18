export const TRAY_THEMES = [
  ['tray-green_felt', 'Green Felt'],
  ['tray-red_velvet', 'Red Velvet'],
  ['tray-midnight_leather', 'Midnight Leather'],
  ['tray-dark_mahogany', 'Dark Mahogany'],
  ['tray-dungeon_stone', 'Dungeon Stone'],
  ['tray-mystic_obsidian', 'Mystic Obsidian'],
  ['tray-neon_cyberpunk', 'Neon Cyberpunk'],
  ['tray-synthwave', 'Synthwave Grid'],
  ['tray-arcane_sanctum', 'Arcane Sanctum'],
  ['tray-celestial_void', 'Celestial Void'],
  ['tray-lava_pit', 'Lava Pit'],
  ['tray-royal_gold', 'Royal Gold']
].map(([id, name]) => ({ id, name }));

export const DIE_SKINS = [
  ['skin-ruby_red', 'Ruby Red', '#b91c1c'],
  ['skin-sapphire_blue', 'Sapphire Blue', '#1d4ed8'],
  ['skin-emerald_green', 'Emerald Green', '#15803d'],
  ['skin-amethyst_purple', 'Amethyst Purple', '#7e22ce'],
  ['skin-marble_white', 'Marble White', '#e5e7eb'],
  ['skin-obsidian_crackle', 'Obsidian', '#18181b'],
  ['skin-gold_leaf', 'Gold Leaf', '#ca8a04'],
  ['skin-neon_cyan', 'Neon Cyan', '#0891b2'],
  ['skin-cosmic_nebula', 'Cosmic Nebula', '#6d28d9'],
  ['skin-dragon_scale', 'Dragon Scale', '#166534'],
  ['skin-frostbite', 'Frostbite', '#60a5fa'],
  ['skin-blood_moon', 'Blood Moon', '#7f1d1d']
].map(([id, name, color]) => ({ id, name, color }));

export function getSkinColor(skinId) {
  try {
    return DIE_SKINS.find(skin => skin.id === skinId)?.color || '#b91c1c';
  } catch (err) {
    console.error('Failed to resolve dice skin color:', err);
    return '#b91c1c';
  }
}

export function countDice(selectedDice) {
  try {
    return selectedDice.reduce((counts, die) => {
      counts[die.type] = (counts[die.type] || 0) + 1;
      return counts;
    }, {});
  } catch (err) {
    console.error('Failed to count selected dice:', err);
    return {};
  }
}

export function buildPhysicsNotation(selectedDice, d20Mode = 'normal') {
  try {
    const pool = [...selectedDice];
    const hasD20 = pool.some(die => die.type === 'd20');

    // Advantage/disadvantage are quick-roll actions. They always need a d20.
    if (d20Mode !== 'normal' && !hasD20) pool.push({ type: 'd20' });

    const counts = countDice(pool);
    const notation = [];

    Object.entries(counts).forEach(([type, count]) => {
      const sides = Number(type.replace('d', ''));
      if (!Number.isInteger(sides) || sides < 2) return;

      if (type === 'd20' && d20Mode !== 'normal') {
        for (let i = 0; i < count; i += 1) notation.push({ qty: 2, sides: 20 });
      } else {
        notation.push({ qty: count, sides });
      }
    });

    return { pool, notation };
  } catch (err) {
    console.error('Failed to build physics notation:', err);
    return { pool: [], notation: [] };
  }
}
