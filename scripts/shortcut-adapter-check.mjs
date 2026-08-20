import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildShortcutCriticalRequest,
  buildShortcutPhysicsRequest,
  compileShortcut,
  createFlexShortcut,
  executeShortcutRoll,
  mapShortcutPhysicsResults,
} from '../js/shortcuts/index.mjs';
import { compileRawCatalogEntry, getRawSpell } from '../js/shortcuts/raw/index.mjs';

function grouped(sides, values) {
  return { sides, rolls: values.map((value) => ({ sides, value })) };
}

function flamingGreatsword() {
  return createFlexShortcut({
    schemaVersion: 1,
    source: 'flex',
    id: 'flaming-greatsword',
    name: 'Flaming Greatsword',
    icon: 'sword',
    category: 'attack',
    variants: [{
      id: 'base',
      label: 'Base',
      scaleRank: 0,
      groups: [
        {
          id: 'attack', label: 'Attack', kind: 'attack', repeat: 1,
          terms: [{ count: 1, sides: 20 }], modifier: 6,
          crit: { policy: 'none' },
        },
        {
          id: 'slashing', label: 'Slashing', kind: 'damage', damageType: 'slashing', repeat: 1,
          terms: [{ count: 2, sides: 6 }], modifier: 11,
          crit: { policy: 'double-dice', triggerGroupId: 'attack' },
        },
        {
          id: 'fire', label: 'Fire', kind: 'damage', damageType: 'fire', repeat: 1,
          terms: [{ count: 1, sides: 6 }], modifier: 0,
          crit: { policy: 'double-dice', triggerGroupId: 'attack' },
        },
      ],
    }],
  });
}

// Fireball 5: one semantic damage instance, 10 physical d6 in one DiceBox request group.
const fireball = getRawSpell('dnd5e-2024', 'fireball');
const fireball5 = compileRawCatalogEntry(fireball, { variantId: 'slot-5' });
const fireballRequest = buildShortcutPhysicsRequest(fireball5);
assert.deepEqual(fireballRequest.notation, [{ qty: 10, sides: 6 }]);
assert.equal(fireballRequest.assignments[0].instanceId, 'damage:1');
const fireballResolved = mapShortcutPhysicsResults(fireballRequest, [grouped(6, [1,2,3,4,5,6,1,2,3,4])]);
assert.deepEqual(fireballResolved[0].dice[0].values, [1,2,3,4,5,6,1,2,3,4]);

// Same-sided damage groups stay separate instead of being merged just because both use d6s.
const swordPlan = compileShortcut(flamingGreatsword());
const swordRequest = buildShortcutPhysicsRequest(swordPlan);
assert.deepEqual(swordRequest.notation, [
  { qty: 1, sides: 20 },
  { qty: 2, sides: 6 },
  { qty: 1, sides: 6 },
]);
assert.deepEqual(swordRequest.assignments.map((entry) => entry.instanceId), ['attack:1', 'slashing:1', 'fire:1']);

const nonCritCalls = [];
const nonCrit = await executeShortcutRoll(swordPlan, async (notation, meta) => {
  nonCritCalls.push({ notation, phase: meta.phase });
  return [grouped(20, [15]), grouped(6, [5, 3]), grouped(6, [4])];
});
assert.equal(nonCritCalls.length, 1);
assert.equal(nonCritCalls[0].phase, 'base');
assert.equal(nonCrit.result.groups.find((group) => group.id === 'attack').instances[0].total, 21);
assert.equal(nonCrit.result.groups.find((group) => group.id === 'slashing').subtotal, 19);
assert.equal(nonCrit.result.groups.find((group) => group.id === 'fire').subtotal, 4);
assert.equal(nonCrit.result.attackTotal, 21);
assert.equal(nonCrit.result.damageTotal, 23);
assert.deepEqual(nonCrit.criticalTriggerInstanceIds, []);
assert.equal(nonCrit.criticalRequest.notation.length, 0);

// RAW-style crit: base dice roll first, then only the additional eligible damage dice.
const critCalls = [];
const critSword = await executeShortcutRoll(swordPlan, async (notation, meta) => {
  critCalls.push({ notation, phase: meta.phase });
  if (meta.phase === 'base') return [grouped(20, [20]), grouped(6, [5, 3]), grouped(6, [4])];
  return [grouped(6, [2, 6]), grouped(6, [5])];
});
assert.equal(critCalls.length, 2);
assert.equal(critCalls[0].phase, 'base');
assert.equal(critCalls[1].phase, 'critical');
assert.deepEqual(critCalls[1].notation, [{ qty: 2, sides: 6 }, { qty: 1, sides: 6 }]);
assert.deepEqual(critSword.criticalTriggerInstanceIds, ['attack:1']);
const critSlash = critSword.result.groups.find((group) => group.id === 'slashing');
const critFire = critSword.result.groups.find((group) => group.id === 'fire');
assert.equal(critSlash.instances[0].modifier, 11, 'Static modifier must not be doubled by RAW crit expansion.');
assert.equal(critSlash.instances[0].diceTotal, 16);
assert.equal(critSlash.instances[0].total, 27);
assert.equal(critSlash.instances[0].critical, true);
assert.equal(critFire.instances[0].total, 9);
assert.equal(critSword.result.damageTotal, 36);
assert.equal(critSword.result.attackTotal, 26, 'Attack totals stay separate from damage totals.');

// The critical request builder itself contains only the delta from base dice to crit-expanded dice.
const baseCritResolved = mapShortcutPhysicsResults(swordRequest, [grouped(20, [20]), grouped(6, [1, 1]), grouped(6, [1])]);
const criticalRequest = buildShortcutCriticalRequest(swordPlan, baseCritResolved);
assert.deepEqual(criticalRequest.request.notation, [{ qty: 2, sides: 6 }, { qty: 1, sides: 6 }]);
assert.ok(criticalRequest.request.assignments.every((entry) => entry.instanceId !== 'attack:1'));

// Scorching Ray: all attacks and damage dice launch in the same initial physical call,
// while attack/damage ownership stays separate and only the matching ray gets crit dice.
const rayEntry = getRawSpell('dnd5e-2024', 'scorching-ray');
const rayPlan = compileRawCatalogEntry(rayEntry, { variantId: 'slot-2', inputs: { toHit: 9 } });
const rayRequest = buildShortcutPhysicsRequest(rayPlan);
assert.equal(rayRequest.notation.length, 6);
assert.deepEqual(rayRequest.notation.slice(0, 3), [
  { qty: 1, sides: 20 }, { qty: 1, sides: 20 }, { qty: 1, sides: 20 },
]);
assert.deepEqual(rayRequest.notation.slice(3), [
  { qty: 2, sides: 6 }, { qty: 2, sides: 6 }, { qty: 2, sides: 6 },
]);
assert.deepEqual(rayRequest.assignments.map((entry) => entry.instanceId), [
  'attack:1', 'attack:2', 'attack:3', 'ray-damage:1', 'ray-damage:2', 'ray-damage:3',
]);

const rayCalls = [];
const rayResult = await executeShortcutRoll(rayPlan, async (notation, meta) => {
  rayCalls.push({ notation, phase: meta.phase });
  if (meta.phase === 'base') {
    return [
      grouped(20, [20]), grouped(20, [10]), grouped(20, [15]),
      grouped(6, [2, 3]), grouped(6, [4, 5]), grouped(6, [6, 1]),
    ];
  }
  return [grouped(6, [6, 6])];
});
assert.equal(rayCalls.length, 2);
assert.deepEqual(rayCalls[1].notation, [{ qty: 2, sides: 6 }]);
const rayAttacks = rayResult.result.groups.find((group) => group.id === 'attack').instances;
const rayDamage = rayResult.result.groups.find((group) => group.id === 'ray-damage').instances;
assert.deepEqual(rayAttacks.map((instance) => instance.total), [29, 19, 24]);
assert.deepEqual(rayDamage.map((instance) => instance.total), [17, 9, 7]);
assert.deepEqual(rayDamage.map((instance) => instance.critical), [true, false, false]);
assert.equal(rayResult.result.damageTotal, 33);
assert.deepEqual(rayResult.criticalTriggerInstanceIds, ['attack:1']);

// Magic Missile: repeats remain individual instances, including +1 per dart.
const missileEntry = getRawSpell('dnd5e-2024', 'magic-missile');
const missilePlan = compileRawCatalogEntry(missileEntry, { variantId: 'slot-1' });
const missileRequest = buildShortcutPhysicsRequest(missilePlan);
assert.deepEqual(missileRequest.notation, [{ qty: 1, sides: 4 }, { qty: 1, sides: 4 }, { qty: 1, sides: 4 }]);
const missile = await executeShortcutRoll(missilePlan, async () => [grouped(4, [2]), grouped(4, [3]), grouped(4, [4])]);
const darts = missile.result.groups[0].instances;
assert.deepEqual(darts.map((instance) => instance.total), [3, 4, 5]);
assert.equal(missile.result.damageTotal, 12);

// Flat DiceBox-like results without group wrappers are consumed deterministically by request order.
const flatMapped = mapShortcutPhysicsResults(swordRequest, [
  { sides: 20, value: 13 },
  { sides: 6, value: 2 }, { sides: 6, value: 5 },
  { sides: 6, value: 4 },
]);
assert.deepEqual(flatMapped.map((entry) => entry.instanceId), ['attack:1', 'slashing:1', 'fire:1']);
assert.deepEqual(flatMapped[1].dice[0].values, [2, 5]);

// Flat results carrying DiceBox groupId are grouped without losing request ordering.
const groupedFlat = mapShortcutPhysicsResults(swordRequest, [
  { groupId: 0, sides: 20, value: 12 },
  { groupId: 1, sides: 6, value: 1 }, { groupId: 1, sides: 6, value: 6 },
  { groupId: 2, sides: 6, value: 3 },
]);
assert.deepEqual(groupedFlat[1].dice[0].values, [1, 6]);

// Bad physical results fail rather than being silently reassigned.
assert.throws(() => mapShortcutPhysicsResults(swordRequest, [grouped(20, [15]), grouped(8, [5, 3]), grouped(6, [4])]), /expected d6, received d8/);
assert.throws(() => mapShortcutPhysicsResults(swordRequest, [grouped(20, [15]), grouped(6, [5]), grouped(6, [4])]), /expected 2d6/);
assert.throws(() => mapShortcutPhysicsResults(swordRequest, [grouped(20, [21]), grouped(6, [5, 3]), grouped(6, [4])]), /Invalid d20/);
assert.rejects(() => executeShortcutRoll(swordPlan, null), /physical dice executor/);

// Isolation gate: Phase 5 adapter exists beside the roller, but the live app does not import it yet.
const adapterSource = await readFile(new URL('../js/shortcuts/roller-adapter.mjs', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const rollerSource = await readFile(new URL('../js/roller.js', import.meta.url), 'utf8');
const physicsSource = await readFile(new URL('../js/physics.js', import.meta.url), 'utf8');

assert.ok(!adapterSource.includes("from '../physics.js'"), 'Phase 5 adapter must use dependency injection, not import live physics.');
assert.ok(!adapterSource.includes('state.selectedDice'), 'Shortcut adapter must not reuse the ordinary selected-dice state.');
assert.ok(!adapterSource.includes('document.'), 'Shortcut adapter must remain DOM-independent.');
assert.ok(!appSource.includes('roller-adapter.mjs'), 'Phase 5 must not wire the adapter into the live app.');
assert.ok(!rollerSource.includes('shortcuts/roller-adapter'), 'Phase 5 must not alter ordinary roller execution.');
assert.ok(physicsSource.includes('export async function rollPhysics(notation, themeColor)'), 'Existing physics boundary must remain intact.');

console.log('Shortcut roller adapter checks passed.');
