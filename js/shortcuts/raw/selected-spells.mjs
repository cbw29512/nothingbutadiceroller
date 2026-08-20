import { cantripDamageVariants, damageGroup, makeRawSpell, slotDamageVariants, variant } from './helpers.mjs';

function iceStormVariants(bludgeoningSides) {
  return Array.from({ length: 6 }, (_, index) => {
    const slot = index + 4;
    return variant(`slot-${slot}`, `Level ${slot}`, slot, [
      damageGroup({ id: 'bludgeoning-damage', label: 'Bludgeoning damage', damageType: 'bludgeoning', count: 2 + index, sides: bludgeoningSides }),
      damageGroup({ id: 'cold-damage', label: 'Cold damage', damageType: 'cold', count: 4, sides: 6 }),
    ]);
  });
}

const fixed = (level, damageType, count, sides, modifier = 0) => [
  variant('base', `Level ${level}`, level, [damageGroup({ damageType, count, sides, modifier })]),
];

const meteorSwarm = () => [variant('base', 'Level 9', 9, [
  damageGroup({ id: 'fire-damage', label: 'Fire damage', damageType: 'fire', count: 20, sides: 6 }),
  damageGroup({ id: 'bludgeoning-damage', label: 'Bludgeoning damage', damageType: 'bludgeoning', count: 20, sides: 6 }),
])];

export function buildSelectedRawSpells({ ruleset, srdVersion, iceStormDie }) {
  const source = (name) => `SRD ${srdVersion} Spell Descriptions: ${name}`;
  const spell = (definition) => makeRawSpell({ ruleset, srdVersion, sourceLocator: source(definition.name), ...definition });
  return Object.freeze([
    spell({ spellId: 'acid-splash', name: 'Acid Splash', spellLevel: 0, scalingMode: 'cantrip-tier', icon: 'potion', variants: cantripDamageVariants({ damageType: 'acid', sides: 6 }) }),
    spell({ spellId: 'fire-bolt', name: 'Fire Bolt', spellLevel: 0, scalingMode: 'cantrip-tier', icon: 'flame', variants: cantripDamageVariants({ damageType: 'fire', sides: 10 }) }),
    spell({ spellId: 'ray-of-frost', name: 'Ray of Frost', spellLevel: 0, scalingMode: 'cantrip-tier', icon: 'frost', variants: cantripDamageVariants({ damageType: 'cold', sides: 8 }) }),
    spell({ spellId: 'burning-hands', name: 'Burning Hands', spellLevel: 1, scalingMode: 'slot', icon: 'flame', variants: slotDamageVariants({ baseLevel: 1, damageType: 'fire', baseCount: 3, sides: 6 }) }),
    spell({ spellId: 'shatter', name: 'Shatter', spellLevel: 2, scalingMode: 'slot', icon: 'spark', variants: slotDamageVariants({ baseLevel: 2, damageType: 'thunder', baseCount: 3, sides: 8 }) }),
    spell({ spellId: 'fireball', name: 'Fireball', spellLevel: 3, scalingMode: 'slot', icon: 'flame', variants: slotDamageVariants({ baseLevel: 3, damageType: 'fire', baseCount: 8, sides: 6 }) }),
    spell({ spellId: 'ice-storm', name: 'Ice Storm', spellLevel: 4, scalingMode: 'slot', icon: 'frost', variants: iceStormVariants(iceStormDie) }),
    spell({ spellId: 'cone-of-cold', name: 'Cone of Cold', spellLevel: 5, scalingMode: 'slot', icon: 'frost', variants: slotDamageVariants({ baseLevel: 5, damageType: 'cold', baseCount: 8, sides: 8 }) }),
    spell({ spellId: 'disintegrate', name: 'Disintegrate', spellLevel: 6, scalingMode: 'slot', icon: 'spark', variants: slotDamageVariants({ baseLevel: 6, damageType: 'force', baseCount: 10, sides: 6, perSlot: 3, modifier: 40 }) }),
    spell({ spellId: 'finger-of-death', name: 'Finger of Death', spellLevel: 7, scalingMode: 'fixed', icon: 'skull', variants: fixed(7, 'necrotic', 7, 8, 30) }),
    spell({ spellId: 'sunburst', name: 'Sunburst', spellLevel: 8, scalingMode: 'fixed', icon: 'sun', variants: fixed(8, 'radiant', 12, 6) }),
    spell({ spellId: 'meteor-swarm', name: 'Meteor Swarm', spellLevel: 9, scalingMode: 'fixed', icon: 'flame', variants: meteorSwarm() }),
  ]);
}

