import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyRollModifier,
  appendModifierBreakdown,
  formatRollModifier,
  normalizeRollModifier,
} from '../js/roll-modifier.mjs';
import {
  HISTORY_SCHEMA_VERSION,
  createShortcutHistoryReroll,
  normalizeHistoryRecord,
  normalizeHistoryReroll,
} from '../js/history-records.mjs';
import { assertValidCompiledShortcutPlan } from '../js/shortcuts/compiled-plan-validation.mjs';
import { state } from '../js/state.js';
import { formatRollButtonLabel } from '../js/ui.js';

assert.equal(normalizeRollModifier(7), 7);
assert.equal(normalizeRollModifier(-5), -5);
assert.equal(normalizeRollModifier(5000), 999);
assert.equal(normalizeRollModifier(-5000), -999);
assert.equal(normalizeRollModifier('bad', 3), 3);
assert.equal(formatRollModifier(7), ' + 7');
assert.equal(formatRollModifier(-2), ' - 2');
assert.equal(applyRollModifier(14, 7), 21);
assert.equal(appendModifierBreakdown('Base roll: d20 = 14', 7), 'Base roll: d20 = 14 • Modifier +7');

state.modifier = 7;
assert.equal(formatRollButtonLabel([{ type: 'd20' }]), 'Roll d20 + 7');
state.modifier = 0;

const legacy = normalizeHistoryRecord({
  time: '10:00 PM',
  formula: '1d20',
  breakdown: 'Base roll: d20 = 12',
  total: '12',
});
assert.equal(legacy.schemaVersion, HISTORY_SCHEMA_VERSION);

const plan = {
  schemaVersion: 1,
  shortcutId: 'test-attack',
  source: 'homebrew',
  name: 'Test Attack',
  category: 'attack',
  icon: 'sword',
  variant: { id: 'base', label: 'Base', scaleRank: 1 },
  groups: [
    {
      id: 'attack',
      label: 'Attack',
      kind: 'attack',
      damageType: null,
      instances: [{
        id: 'attack:1',
        groupId: 'attack',
        repeatIndex: 0,
        kind: 'attack',
        damageType: null,
        terms: [{ count: 1, sides: 20 }],
        modifier: 7,
        crit: { policy: 'none', triggerInstanceId: null },
      }],
    },
    {
      id: 'damage',
      label: 'Damage',
      kind: 'damage',
      damageType: 'slashing',
      instances: [{
        id: 'damage:1',
        groupId: 'damage',
        repeatIndex: 0,
        kind: 'damage',
        damageType: 'slashing',
        terms: [{ count: 2, sides: 6 }],
        modifier: 4,
        crit: { policy: 'double-dice', triggerInstanceId: 'attack:1' },
      }],
    },
  ],
};
assert.equal(assertValidCompiledShortcutPlan(plan), plan);
const shortcutReroll = createShortcutHistoryReroll(plan);
assert.equal(normalizeHistoryReroll(shortcutReroll)?.kind, 'shortcut');

const unsafePlan = structuredClone(plan);
unsafePlan.groups[1].instances[0].terms[0].count = 40;
assert.throws(() => assertValidCompiledShortcutPlan(unsafePlan), /limit is 40/);

const [controls, styles, app] = await Promise.all([
  readFile(new URL('../js/table-speed-controls.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/table-speed.css', import.meta.url), 'utf8'),
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
]);
assert.ok(controls.includes("button.dataset.quickRoll = 'normal'"));
assert.ok(controls.includes("input.dataset.rollModifier = 'true'"));
assert.ok(styles.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
assert.ok(app.includes("ensureStylesheet('table-speed-styles', '/js/table-speed.css')"));
assert.ok(app.includes('initTableSpeedControls()'));

console.log('Table-speed contracts passed: bounded modifiers, modifier-aware labels/totals, versioned history, validated shortcut replay, one-tap D20 controls, and narrow-phone layout.');
