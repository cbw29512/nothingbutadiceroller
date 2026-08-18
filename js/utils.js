export const TRAY_THEMES = [
  { id: 'tray-green_felt', name: 'Green Felt' },
  { id: 'tray-red_velvet', name: 'Red Velvet' },
  { id: 'tray-midnight_leather', name: 'Midnight Leather' },
  { id: 'tray-dark_mahogany', name: 'Dark Mahogany' },
  { id: 'tray-dungeon_stone', name: 'Dungeon Stone' },
  { id: 'tray-mystic_obsidian', name: 'Mystic Obsidian' },
  { id: 'tray-neon_cyberpunk', name: 'Neon Cyberpunk' },
  { id: 'tray-synthwave', name: 'Synthwave Grid' },
  { id: 'tray-arcane_sanctum', name: 'Arcane Sanctum' },
  { id: 'tray-celestial_void', name: 'Celestial Void' },
  { id: 'tray-lava_pit', name: 'Lava Pit' },
  { id: 'tray-royal_gold', name: 'Royal Gold' }
];

export const DIE_SKINS = [
  { id: 'skin-ruby_red', name: 'Ruby Red' },
  { id: 'skin-sapphire_blue', name: 'Sapphire Blue' },
  { id: 'skin-emerald_green', name: 'Emerald Green' },
  { id: 'skin-amethyst_purple', name: 'Amethyst Purple' },
  { id: 'skin-marble_white', name: 'Marble White' },
  { id: 'skin-obsidian_crackle', name: 'Obsidian' },
  { id: 'skin-gold_leaf', name: 'Gold Leaf' },
  { id: 'skin-neon_cyan', name: 'Neon Cyan' },
  { id: 'skin-cosmic_nebula', name: 'Cosmic Nebula' },
  { id: 'skin-dragon_scale', name: 'Dragon Scale' },
  { id: 'skin-frostbite', name: 'Frostbite' },
  { id: 'skin-blood_moon', name: 'Blood Moon' }
];

export function getDieSides(type) {
  return parseInt(type.replace('d', ''), 10);
}

/**
 * Generates a cryptographically secure random integer.
 * Uses system hardware entropy (as close to true randomness as possible 
 * outside of quantum hardware) via the Web Crypto API.
 */
export function rollDie(sides) {
  try {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % sides) + 1;
  } catch (err) {
    // Fallback failsafe if crypto unavailable
    return Math.floor(Math.random() * sides) + 1;
  }
}