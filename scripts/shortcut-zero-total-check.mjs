import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { groupResolvedResults } from '../js/shortcuts/results.mjs';

const plan = {
  shortcutId: 'zero-damage-check',
  variant: { id: 'base' },
  groups: [{
    id: 'damage',
    label: 'Damage',
    kind: 'damage',
    damageType: 'force',
    instances: [{
      id: 'damage:1',
      repeatIndex: 0,
      terms: [{ count: 1, sides: 4 }],
      modifier: -1,
      critical: false,
    }],
  }],
};

const grouped = groupResolvedResults(plan, [{
  instanceId: 'damage:1',
  dice: [{ sides: 4, values: [1] }],
}]);

assert.equal(grouped.groups[0].subtotal, 0, 'A legal roll plus modifier may resolve to exactly zero damage.');
assert.equal(grouped.totalsByKind.damage, 0, 'The result engine must preserve numeric zero instead of treating it as absent.');
assert.equal(grouped.groups[0].kind, 'damage');

const runtime = await readFile(new URL('../js/shortcuts/runtime.js', import.meta.url), 'utf8');
assert.ok(runtime.includes("hasShortcutResultKind(execution, 'damage')"), 'Zero damage must be detected from the damage group, not numeric truthiness.');
assert.ok(runtime.includes("hasShortcutResultKind(execution, 'healing')"), 'Zero healing must be detected from the healing group, not numeric truthiness.');
assert.ok(!/if \(execution\.result\.(?:damageTotal|healingTotal)\)/.test(runtime), 'Result formatting must not hide zero totals.');
assert.ok(!/total:\s*execution\.result\.damageTotal\s*\?/.test(runtime), 'History labels must not hide zero damage totals.');

console.log('Shortcut zero-total checks passed: legitimate 0 damage/healing remains visible instead of becoming Grouped or —.');
