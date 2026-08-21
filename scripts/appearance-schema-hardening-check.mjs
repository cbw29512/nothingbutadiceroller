import assert from 'node:assert/strict';
import { createUserDiceSet, cloneDiceSet } from '../js/appearance/schema.mjs';
import { migrateLegacyTheme } from '../js/appearance/migration.mjs';
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

const legacyImageUrl = '/api/theme-image?owner=owner_local-1&theme=legacy_set&token=abc123';
const migrated = migrateLegacyTheme({
  themeId: 'legacy_set', ownerId: 'owner_local-1', name: 'Legacy Set', diceColor: '#123456', trayColor: '#654321',
  imageUrl: legacyImageUrl, isPublic: true,
});
assert.equal(validateDiceSet(migrated).ok, true, 'Legacy migration must produce an exact valid V2 set.');
assert.deepEqual(migrated.appearance.tray.image, { kind: 'legacy', url: legacyImageUrl });
assert.equal(migrated.locked, true); assert.equal(migrated.visibility, 'public');

console.log('Appearance schema hardening passed: safe ids, bounded names, exact persisted fields, and valid legacy migration are enforced.');
