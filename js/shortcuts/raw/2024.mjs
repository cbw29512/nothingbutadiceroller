import { attackGroup, cantripDamageVariants, damageGroup, makeRawSpell, slotDamageVariants, variant } from './helpers.mjs';

const RULESET = 'dnd5e-2024';
const SRD = '5.2.1';

function acidArrowVariants() {
  const variants = [];
  for (let slot = 2; slot <= 9; slot += 1) {
    const bonus = slot - 2;
    variants.push(variant(`slot-${slot}`, `Level ${slot}`, slot, [
      attackGroup({ repeat: 1 }),
      damageGroup({ id: 'initial-damage', label: 'Initial acid', damageType: 'acid', count: 4 + bonus, sides: 4, crit: true }),
      damageGroup({ id: 'later-damage', label: 'Later acid', damageType: 'acid', count: 2 + bonus, sides: 4 }),
    ]));
  }
  return variants;
}

function magicMissileVariants() {
  const variants = [];
  for (let slot = 1; slot <= 9; slot += 1) {
    variants.push(variant(`slot-${slot}`, `Level ${slot}`, slot, [
      damageGroup({ id: 'dart-damage', label: 'Force dart', damageType: 'force', count: 1, sides: 4, modifier: 1, repeat: slot + 2 }),
    ]));
  }
  return variants;
}

function scorchingRayVariants() {
  const variants = [];
  for (let slot = 2; slot <= 9; slot += 1) {
    const rays = slot + 1;
    variants.push(variant(`slot-${slot}`, `Level ${slot}`, slot, [
      attackGroup({ repeat: rays }),
      damageGroup({ id: 'ray-damage', label: 'Fire ray', damageType: 'fire', count: 2, sides: 6, repeat: rays, crit: true }),
    ]));
  }
  return variants;
}

export const RAW_2024 = Object.freeze([
  makeRawSpell({
    ruleset: RULESET, srdVersion: SRD, spellId: 'acid-arrow', name: 'Acid Arrow', spellLevel: 2,
    scalingMode: 'slot', icon: 'spark', sourceLocator: 'SRD 5.2.1 Spell Descriptions: Acid Arrow',
    variants: acidArrowVariants(), requiresToHit: true,
  }),
  makeRawSpell({
    ruleset: RULESET, srdVersion: SRD, spellId: 'acid-splash', name: 'Acid Splash', spellLevel: 0,
    scalingMode: 'cantrip-tier', icon: 'potion', sourceLocator: 'SRD 5.2.1 Spell Descriptions: Acid Splash',
    variants: cantripDamageVariants({ damageType: 'acid', sides: 6 }),
  }),
  makeRawSpell({
    ruleset: RULESET, srdVersion: SRD, spellId: 'fire-bolt', name: 'Fire Bolt', spellLevel: 0,
    scalingMode: 'cantrip-tier', icon: 'flame', sourceLocator: 'SRD 5.2.1 Spell Descriptions: Fire Bolt',
    variants: cantripDamageVariants({ damageType: 'fire', sides: 10, crit: true, includeAttack: true }), requiresToHit: true,
  }),
  makeRawSpell({
    ruleset: RULESET, srdVersion: SRD, spellId: 'fireball', name: 'Fireball', spellLevel: 3,
    scalingMode: 'slot', icon: 'flame', sourceLocator: 'SRD 5.2.1 Spell Descriptions: Fireball',
    variants: slotDamageVariants({ baseLevel: 3, damageType: 'fire', baseCount: 8, sides: 6, perSlot: 1 }),
  }),
  makeRawSpell({
    ruleset: RULESET, srdVersion: SRD, spellId: 'magic-missile', name: 'Magic Missile', spellLevel: 1,
    scalingMode: 'slot', icon: 'spark', sourceLocator: 'SRD 5.2.1 Spell Descriptions: Magic Missile',
    variants: magicMissileVariants(),
  }),
  makeRawSpell({
    ruleset: RULESET, srdVersion: SRD, spellId: 'scorching-ray', name: 'Scorching Ray', spellLevel: 2,
    scalingMode: 'slot', icon: 'sun', sourceLocator: 'SRD 5.2.1 Spell Descriptions: Scorching Ray',
    variants: scorchingRayVariants(), requiresToHit: true,
  }),
  makeRawSpell({
    ruleset: RULESET, srdVersion: SRD, spellId: 'disintegrate', name: 'Disintegrate', spellLevel: 6,
    scalingMode: 'slot', icon: 'spark', sourceLocator: 'SRD 5.2.1 Spell Descriptions: Disintegrate',
    variants: slotDamageVariants({ baseLevel: 6, damageType: 'force', baseCount: 10, sides: 6, perSlot: 3, modifier: 40 }),
  }),
  makeRawSpell({
    ruleset: RULESET, srdVersion: SRD, spellId: 'harm', name: 'Harm', spellLevel: 6,
    scalingMode: 'fixed', icon: 'skull', sourceLocator: 'SRD 5.2.1 Spell Descriptions: Harm',
    variants: [variant('base', 'Level 6', 6, [damageGroup({ damageType: 'necrotic', count: 14, sides: 6 })])],
  }),
]);
