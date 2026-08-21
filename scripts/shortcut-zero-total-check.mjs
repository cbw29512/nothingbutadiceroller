import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileShortcut, createFlexShortcut, executeShortcutRoll } from '../js/shortcuts/index.mjs';

const zeroDamageShortcut = createFlexShortcut({
  schemaVersion: 1,
  source: 'flex',
  id: 'zero-damage-check',
  name: 'Zero Damage Check',
  icon: 'sword',
  category: 'custom',
  variants: [{
    id: 'base',
    label: 'Base',
    scaleRank: 0,
    groups: [{
      id: 'damage',
      label: 'Damage',
      kind: 'damage',
      damageType: 'force',
      repeat: 1,
      terms: [{ count: 1, sides: 4 }],
      modifier: -1,
      crit: { policy: 'none' },
    }],
  }],
});

const plan = compileShortcut(zeroDamageShortcut);
const execution = await executeShortcutRoll(plan, async (notation) => {
  assert.deepEqual(notation, [{ qty: 1, sides: 4 }]);
  return [{ sides: 4, rolls: [{ sides: 4, value: 1 }] }];
});
assert.equal(execution.result.damageTotal, 0, 'A legal shortcut may resolve to exactly zero damage.');
assert.equal(execution.result.groups[0].kind, 'damage');

const runtime = await readFile(new URL('../js/shortcuts/runtime.js', import.meta.url), 'utf8');
assert.ok(runtime.includes("hasShortcutResultKind(execution, 'damage')"), 'Zero damage must be detected from the damage group, not numeric truthiness.');
assert.ok(runtime.includes("hasShortcutResultKind(execution, 'healing')"), 'Zero healing must be detected from the healing group, not numeric truthiness.');
assert.ok(!/if \(execution\.result\.(?:damageTotal|healingTotal)\)/.test(runtime), 'Result formatting must not hide zero totals.');
assert.ok(!/total:\s*execution\.result\.damageTotal\s*\?/.test(runtime), 'History labels must not hide zero damage totals.');

console.log('Shortcut zero-total checks passed: legal 0 damage/healing remains visible instead of becoming Grouped or —.');
