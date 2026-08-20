import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createFlexManagerSlot,
  createRawManagerSlot,
  moveShortcutSlot,
  removeShortcutSlot,
  updateManagerOptions,
} from '../js/shortcuts/manager-state.mjs';
import { getRawSpell } from '../js/shortcuts/raw/index.mjs';

const fireball = getRawSpell('dnd5e-2024', 'fireball');
const fireballSlot = createRawManagerSlot([], fireball, { variantId: 'slot-5', icon: 'flame' });
assert.equal(fireballSlot.source, 'raw');
assert.equal(fireballSlot.ruleset, 'dnd5e-2024');
assert.equal(fireballSlot.spellId, 'fireball');
assert.equal(fireballSlot.baseVariantId, 'slot-5');
assert.deepEqual(fireballSlot.inputs, {});
assert.equal(Object.prototype.hasOwnProperty.call(fireballSlot, 'definition'), false);

const fireBolt = getRawSpell('dnd5e-2024', 'fire-bolt');
assert.throws(() => createRawManagerSlot([], fireBolt, { variantId: 'tier-2', icon: 'flame' }), /To-hit modifier/);
const fireBoltSlot = createRawManagerSlot([fireballSlot], fireBolt, { variantId: 'tier-4', icon: 'bolt', toHit: 9 });
assert.equal(fireBoltSlot.inputs.toHit, 9);

const flexSlot = createFlexManagerSlot([fireballSlot, fireBoltSlot], {
  name: 'Flaming Greatsword',
  icon: 'sword',
  category: 'attack',
  groups: [
    { id: 'attack', label: 'Attack', kind: 'attack', count: 1, sides: 20, modifier: 6, repeat: 1 },
    { id: 'slashing', label: 'Slashing Damage', kind: 'damage', count: 2, sides: 6, modifier: 11, repeat: 1, damageType: 'slashing', critEligible: true, triggerGroupId: 'attack' },
    { id: 'fire', label: 'Fire Damage', kind: 'damage', count: 1, sides: 6, modifier: 0, repeat: 1, damageType: 'fire', critEligible: true, triggerGroupId: 'attack' },
  ],
});
const groups = flexSlot.definition.variants[0].groups;
assert.equal(groups.length, 3);
assert.equal(groups[0].kind, 'attack');
assert.equal(groups[1].damageType, 'slashing');
assert.equal(groups[1].crit.policy, 'double-dice');
assert.equal(groups[1].crit.triggerGroupId, 'attack');
assert.equal(groups[2].damageType, 'fire');

const initial = [fireballSlot, fireBoltSlot, flexSlot];
const moved = moveShortcutSlot(initial, flexSlot.id, -2);
assert.equal(moved[0].id, flexSlot.id);
assert.equal(moved[1].id, fireballSlot.id);
const removed = removeShortcutSlot(moved, fireballSlot.id);
assert.equal(removed.length, 2);
assert.equal(removed.some((slot) => slot.id === fireballSlot.id), false);

const customOptions = updateManagerOptions(
  { criticalMode: 'raw', preferredRuleset: 'dnd5e-2024' },
  { criticalMode: 'custom', preferredRuleset: 'dnd5e-2014' },
);
assert.deepEqual(customOptions, { criticalMode: 'custom', preferredRuleset: 'dnd5e-2014' });

const html = await readFile(new URL('../rolls.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../js/rolls.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../rolls.css', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../js/shortcuts/runtime.js', import.meta.url), 'utf8');
const buildSource = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');

for (const required of [
  'id="manager-toolbar"',
  'data-tab="2024"',
  'data-tab="2014"',
  'data-tab="homebrew"',
  'data-tab="options"',
  'id="critical-mode"',
  '<option value="raw">RAW</option>',
  '<option value="custom">Custom</option>',
  'id="preferred-ruleset"',
  'id="add-homebrew-group"',
  'id="save-workspace"',
]) assert.ok(html.includes(required), `Manager HTML contract missing: ${required}`);
assert.ok(html.includes('safely falls back to RAW critical dice'));
assert.ok(source.includes('renderShortcutToolbar('));
assert.ok(source.includes('createRawManagerSlot('));
assert.ok(source.includes('createFlexManagerSlot('));
assert.ok(source.includes('saveShortcutWorkspace(shortcuts, serverState.version, options)'));
assert.ok(!source.includes('.innerHTML'), 'Manager must not render user Homebrew text through innerHTML.');
assert.ok(css.includes('repeat(8, minmax(0, 1fr))'), 'Mobile organizer must preserve eight shortcut columns.');
assert.ok(runtime.includes("'/rolls.html'"), 'Live gear must route to the real Phase 7 manager.');
assert.ok(!runtime.includes("location.href = '/shortcut-harness.html'"), 'Live gear must not route to the development harness.');
assert.ok(buildSource.includes("'rolls.html'"));
assert.ok(buildSource.includes("rolls: resolve(root, 'js/rolls.js')"));

console.log('Shortcut manager checks passed.');
