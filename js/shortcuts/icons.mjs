import { BUILTIN_ICON_IDS } from './constants.mjs';

const ICON_GLYPHS = Object.freeze({
  sword: '⚔',
  bow: '➶',
  shield: '⬟',
  spark: '✦',
  flame: '♨',
  frost: '❄',
  bolt: 'ϟ',
  skull: '☠',
  heart: '♥',
  star: '★',
  moon: '☾',
  sun: '☀',
  wand: '✧',
  staff: '⚕',
  claw: '⌁',
  paw: '♣',
  potion: '⚗',
  book: '▤',
  eye: '◉',
  hand: '✋',
  hammer: '⚒',
  axe: '◈',
  dagger: '†',
  dice: '◆',
});

for (const id of BUILTIN_ICON_IDS) {
  if (!ICON_GLYPHS[id]) throw new Error(`Missing shortcut icon glyph for ${id}`);
}
if (new Set(Object.values(ICON_GLYPHS)).size !== BUILTIN_ICON_IDS.length) {
  throw new Error('Every built-in shortcut icon must use a distinct glyph.');
}

export function getShortcutIconGlyph(iconId) {
  const glyph = ICON_GLYPHS[iconId];
  if (!glyph) throw new Error(`Unknown shortcut icon: ${iconId}`);
  return glyph;
}

export const SHORTCUT_ICON_GLYPHS = ICON_GLYPHS;
