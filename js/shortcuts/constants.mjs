export const SHORTCUT_SCHEMA_VERSION = 1;
export const MAX_SHORTCUTS = 24;
export const MAX_GROUPS = 16;
export const MAX_REPEAT = 24;
export const MAX_DICE_TERMS = 12;
export const MAX_DICE_COUNT = 100;
export const MAX_MODIFIER = 1000;

export const ROLLER_DIE_SIDES = Object.freeze([4, 6, 8, 10, 12, 20, 100]);
export const SHORTCUT_SOURCES = Object.freeze(['raw', 'flex']);
export const SHORTCUT_CATEGORIES = Object.freeze(['attack', 'spell', 'healing', 'save', 'check', 'utility', 'custom']);
export const GROUP_KINDS = Object.freeze(['attack', 'damage', 'healing', 'save', 'check', 'utility']);
export const CRIT_POLICIES = Object.freeze(['none', 'double-dice']);
export const RAW_RULESETS = Object.freeze(['dnd5e-2014', 'dnd5e-2024']);

export const BUILTIN_ICON_IDS = Object.freeze([
  'sword', 'bow', 'shield', 'spark', 'flame', 'frost', 'bolt', 'skull',
  'heart', 'star', 'moon', 'sun', 'wand', 'staff', 'claw', 'paw',
  'potion', 'book', 'eye', 'hand', 'hammer', 'axe', 'dagger', 'dice',
]);
