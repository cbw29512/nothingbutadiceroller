import { deepFreeze } from '../schema.mjs';

export const RAW_COVERAGE = deepFreeze({
  catalogSchemaVersion: 1,
  exhaustive: false,
  policy: 'Only official SRD damage rolls that can be represented with locked RAW mechanics plus, where necessary, a single player-supplied final to-hit modifier are shippable in V1.',
  rulesets: {
    'dnd5e-2014': {
      srdVersion: '5.1',
      verifiedSpellIds: [
        'acid-arrow',
        'acid-splash',
        'burning-hands',
        'fire-bolt',
        'fireball',
        'guiding-bolt',
        'lightning-bolt',
        'magic-missile',
        'ray-of-frost',
        'scorching-ray',
        'shatter',
        'thunderwave',
        'disintegrate',
        'harm',
      ],
    },
    'dnd5e-2024': {
      srdVersion: '5.2.1',
      verifiedSpellIds: [
        'acid-arrow',
        'acid-splash',
        'burning-hands',
        'fire-bolt',
        'fireball',
        'guiding-bolt',
        'lightning-bolt',
        'magic-missile',
        'ray-of-frost',
        'scorching-ray',
        'shatter',
        'thunderwave',
        'disintegrate',
        'harm',
      ],
    },
  },
  deferredPatterns: [
    {
      id: 'weapon-dependent-damage',
      examples: ['Shillelagh', 'True Strike'],
      reason: 'The spell modifies or depends on a weapon/base attack that is not part of the standalone RAW shortcut input model.',
    },
    {
      id: 'extra-character-damage-modifier',
      examples: ['Spiritual Weapon', 'Flame Blade'],
      reason: 'The damage roll requires a character-specific modifier beyond the approved final to-hit input. V1 does not become a character sheet.',
    },
    {
      id: 'contextual-rider-damage',
      examples: ['Hex', 'Divine Favor'],
      reason: 'The spell adds damage to another attack rather than producing a standalone roll. These combinations belong in Flex/Homebrew until a contextual RAW adapter is designed.',
    },
    {
      id: 'runtime-damage-choice',
      examples: ['Chromatic Orb'],
      reason: 'The damage type is chosen at cast time. V1 RAW definitions are locked and do not yet expose a legal runtime damage-type selector.',
    },
  ],
});

export function assertCoverageMatchesCatalog(catalog, ruleset) {
  const coverage = RAW_COVERAGE.rulesets[ruleset];
  if (!coverage) throw new Error(`No RAW coverage record for ${ruleset}`);
  const actual = [...catalog.map((entry) => entry.spellId)].sort();
  const expected = [...coverage.verifiedSpellIds].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${ruleset} RAW catalog and coverage ledger are out of sync`);
  }
  return true;
}
