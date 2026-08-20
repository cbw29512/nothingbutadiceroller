import assert from 'node:assert/strict';
import { SYSTEM_DEFAULT_DICE_SET } from '../js/appearance/defaults.mjs';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import {
  canDeleteDiceSet,
  canEditDiceSet,
  canLockDiceSet,
  canPublishDiceSet,
  canUnlockDiceSet,
  canUseDiceSet,
} from '../js/appearance/authorization.mjs';
import { validateDiceSet } from '../js/appearance/validation.mjs';
import { migrateLegacyTheme } from '../js/appearance/migration.mjs';
import { resetToSystemDefault, resolveActiveDiceSet } from '../js/appearance/resolver.mjs';
import { lockDiceSet, makeDiceSetPrivate, publishDiceSet, unlockDiceSet } from '../js/appearance/transitions.mjs';

const owner = 'user_owner';
const visitor = 'user_visitor';
const draft = createUserDiceSet({ id: 'set_necromancer', ownerId: owner, name: 'Necromancer' });
assert.equal(validateDiceSet(draft).ok, true);
assert.equal(canEditDiceSet(draft, owner), true);
assert.equal(canEditDiceSet(draft, visitor), false);
assert.equal(canLockDiceSet(draft, owner), true);
assert.equal(canPublishDiceSet(draft, owner), false);
assert.equal(canDeleteDiceSet(draft, visitor), false);

const badPublic = structuredClone(draft);
badPublic.visibility = 'public';
assert.equal(validateDiceSet(badPublic).ok, false);

const locked = lockDiceSet(draft, owner);
assert.equal(locked.locked, true);
const published = publishDiceSet(locked, owner);
assert.equal(published.visibility, 'public');
assert.equal(canUseDiceSet(published, visitor), true);
assert.equal(canEditDiceSet(published, owner), false);
assert.equal(canUnlockDiceSet(published, visitor), false);

const privateAgain = makeDiceSetPrivate(published, owner);
assert.equal(privateAgain.visibility, 'private');
const unlockedAgain = unlockDiceSet(privateAgain, owner);
assert.equal(unlockedAgain.locked, false);
assert.throws(() => unlockDiceSet(SYSTEM_DEFAULT_DICE_SET, owner));
assert.throws(() => publishDiceSet(draft, owner));

assert.equal(canEditDiceSet(SYSTEM_DEFAULT_DICE_SET, owner), false);
assert.equal(canDeleteDiceSet(SYSTEM_DEFAULT_DICE_SET, owner), false);
assert.equal(canUnlockDiceSet(SYSTEM_DEFAULT_DICE_SET, owner), false);
assert.equal(resetToSystemDefault(), SYSTEM_DEFAULT_DICE_SET);
assert.equal(resolveActiveDiceSet('missing', [published], visitor), SYSTEM_DEFAULT_DICE_SET);
assert.equal(resolveActiveDiceSet(published.id, [published], visitor), published);

const migrated = migrateLegacyTheme({
  themeId: 'legacy_public', ownerId: owner, themeName: 'Legacy Fire', isPublic: true,
  customStyles: {
    baseColor: '#111111', diceColor: '#ff3300', numberColor: '#ffff00',
    enableGlow: true, glowColor: '#ff00ff', opacity: 0.9,
  },
}, { ownerId: owner });
assert.equal(migrated.locked, true);
assert.equal(migrated.visibility, 'public');
assert.equal(validateDiceSet(migrated).ok, true);
console.log('Appearance ownership passed: default immutability, lock, publish, use, and fallback rules are protected.');
