import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlexManagerSlot } from '../js/shortcuts/manager-flex-state.mjs';
import { MAX_SHORTCUT_PHYSICAL_DICE, variantPhysicalDiceBudget } from '../js/shortcuts/dice-budget.mjs';
import {
  createRawManagerSlot, duplicateFlexShortcutSlot, moveShortcutSlot, removeShortcutSlot, updateManagerOptions,
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
const fireBoltSlot = createRawManagerSlot([fireballSlot], fireBolt, { variantId: 'tier-4', icon: 'bolt', toHit: 9 });
assert.deepEqual(fireBoltSlot.inputs, {});

const flexSlot = createFlexManagerSlot([fireballSlot, fireBoltSlot], {
  name: 'Flaming Greatsword', icon: 'sword', category: 'attack',
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
assert.equal(MAX_SHORTCUT_PHYSICAL_DICE, 40);
assert.deepEqual(variantPhysicalDiceBudget([{ count: 20, sides: 100, repeat: 1 }]), { base: 40, critical: 0, maximum: 40 });
assert.throws(() => createFlexManagerSlot([], {
  name: 'Too Many Dice', icon: 'dice', category: 'spell',
  groups: [{ id: 'damage', label: 'Damage', kind: 'damage', count: 21, sides: 100, modifier: 0, repeat: 1, damageType: 'force' }],
}), /needs up to 42 physical dice/);
assert.doesNotThrow(() => createFlexManagerSlot([], {
  name: 'Meteor Scale', icon: 'flame', category: 'spell',
  groups: [{ id: 'damage', label: 'Damage', kind: 'damage', count: 40, sides: 6, modifier: 0, repeat: 1, damageType: 'fire' }],
}));

const moved = moveShortcutSlot([fireballSlot, fireBoltSlot, flexSlot], flexSlot.id, -2);
assert.equal(moved[0].id, flexSlot.id);
assert.equal(moved[1].id, fireballSlot.id);
const removed = removeShortcutSlot(moved, fireballSlot.id);
assert.equal(removed.length, 2);
assert.equal(removed.some((slot) => slot.id === fireballSlot.id), false);
const removeAll = removed.reduce((slots, slot) => removeShortcutSlot(slots, slot.id), removed);
assert.deepEqual(removeAll, []);
const duplicated = duplicateFlexShortcutSlot([flexSlot], flexSlot.id);
assert.equal(duplicated.length, 2);
assert.equal(duplicated[1].source, 'flex');
assert.equal(duplicated[1].definition.name, 'Flaming Greatsword Copy');
assert.notEqual(duplicated[1].id, flexSlot.id);
assert.throws(() => duplicateFlexShortcutSlot([fireballSlot], fireballSlot.id), /Only custom shortcuts/);

const customOptions = updateManagerOptions(
  { criticalMode: 'raw', preferredRuleset: 'dnd5e-2024' },
  { criticalMode: 'custom', preferredRuleset: 'dnd5e-2014' },
);
assert.deepEqual(customOptions, { criticalMode: 'custom', preferredRuleset: 'dnd5e-2014' });

const managerPaths = [
  '../js/rolls.js',
  '../js/shortcuts/manager-context.mjs',
  '../js/shortcuts/manager-flex-state.mjs',
  '../js/shortcuts/manager-homebrew-fields.mjs',
  '../js/shortcuts/manager-homebrew.mjs',
  '../js/shortcuts/manager-ids.mjs',
  '../js/shortcuts/manager-organizer.mjs',
  '../js/shortcuts/manager-raw.mjs',
  '../js/shortcuts/manager-session.mjs',
  '../js/shortcuts/manager-state.mjs',
  '../js/shortcuts/manager-ui.mjs',
];
const managerModules = await Promise.all(managerPaths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
assert.ok(managerModules.every((source) => !source.includes('Save Changes to sync it.')));
const managerSource = managerModules.join('\n');
managerModules.forEach((source, index) => {
  const lineCount = source.split('\n').length;
  assert.ok(lineCount <= 150, `${managerPaths[index]} must stay at or below 150 lines; received ${lineCount}`);
});

const html = await readFile(new URL('../rolls.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../rolls.css', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../js/shortcuts/runtime.js', import.meta.url), 'utf8');
const buildSource = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');
for (const required of [
  'id="manager-toolbar"', 'data-tab="2024"', 'data-tab="2014"', 'data-tab="homebrew"',
  'data-tab="options"', 'id="preferred-ruleset"', 'id="add-homebrew-group"',
  'id="save-workspace"',
  '<summary>How to use shortcuts</summary>', 'Damage-only examples are locked', 'id="homebrew-dice-budget"',
  'Build Your Own Shortcut', 'Attack: 1d20 + 7', 'Add Custom Shortcut to Toolbar',
  'id="validate-homebrew"', 'id="duplicate-shortcut"', 'id="reset-shortcuts"',
]) assert.ok(html.includes(required), `Manager HTML contract missing: ${required}`);
assert.equal(html.includes('<option value="custom">Custom</option>'), false, 'Undefined Custom Critical option must stay hidden.');
for (const label of ['Group name', 'Roll type', 'Number of dice', 'Die type', 'Bonus / Modifier', 'Attacks / Targets']) {
  assert.ok(managerModules.some((source) => source.includes(label)), `Homebrew field label missing: ${label}`);
}
assert.ok(css.includes('.manager-help'));
assert.ok(
  html.indexOf('data-tab="2014"') < html.indexOf('data-tab="2024"'),
  '2014 RAW must appear before 2024 RAW in the manager tabs.',
);
for (const required of ['renderShortcutToolbar(', 'createRawManagerSlot(', 'createFlexManagerSlot(', 'saveShortcutWorkspace(']) {
  assert.ok(managerSource.includes(required), `Manager behavior missing after modular split: ${required}`);
}
assert.ok(!managerSource.includes('.innerHTML'), 'Manager must not render user Homebrew text through innerHTML.');
assert.ok(css.includes('repeat(8, minmax(0, 1fr))'), 'Mobile organizer must preserve eight shortcut columns.');
assert.ok(runtime.includes("'/rolls.html'"));
assert.ok(!runtime.includes("location.href = '/shortcut-harness.html'"));
assert.ok(buildSource.includes("'rolls.html'"));
assert.ok(buildSource.includes("rolls: resolve(root, 'js/rolls.js')"));

console.log('Shortcut manager checks passed, including <=150-line modularity for manager JavaScript.');

