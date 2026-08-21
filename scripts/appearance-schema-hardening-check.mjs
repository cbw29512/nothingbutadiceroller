import assert from 'node:assert/strict';
import { createUserDiceSet, cloneDiceSet } from '../js/appearance/schema.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';

function validSet() {
  return createUserDiceSet({ id: 'set_safe-1', ownerId: 'owner_local-1', name: 'Safe Set' });
}
function expectInvalid(mutator, label) {
  const candidate = cloneDiceSet(validSet());
  mutator(candidate);
  const result = validateDiceSet(candidate);
  assert.equal(result.ok, false, `${label} must be rejected.`);
}

assert.equal(validateDiceSet(validSet()).ok, true);
for (const id of ['../index', 'set/other', 'set other', '.hidden', 'a'.repeat(81), 'set\nname']) {
  assert.throws(() => createUserDiceSet({ id, ownerId: 'owner_local-1' }), /Dice set id/);
}
expectInvalid((set) => { set.contact = 'not part of schema'; }, 'unknown top-level field');
expectInvalid((set) => { set.name = 'Bad\nName'; }, 'control characters in set name');
expectInvalid((set) => { set.appearance.contact = 'not part of schema'; }, 'unknown appearance field');
expectInvalid((set) => { set.appearance.diceSet.defaultStyle.extra = true; }, 'unknown default-style field');
expectInvalid((set) => { set.appearance.tray.extra = true; }, 'unknown tray field');
expectInvalid((set) => { set.appearance.diceSet.dice.d20.extra = true; }, 'unknown die field');
expectInvalid((set) => {
  set.appearance.diceSet.dice.d20.faceMode = 'custom';
  set.appearance.diceSet.dice.d20.faces['20'] = { kind: 'text', value: '★', extra: 'not allowed' };
}, 'unknown face field');

console.log('Appearance schema hardening passed: safe ids, bounded names, and exact persisted fields are enforced.');
