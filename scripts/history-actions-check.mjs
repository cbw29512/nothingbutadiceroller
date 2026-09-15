import assert from 'node:assert/strict';
import {
  canRerollHistoryItem,
  createCustomHistoryReroll,
  createStandardHistoryReroll,
  formatHistoryItemForCopy,
  normalizeHistoryReroll,
} from '../js/history-records.mjs';

const standard = createStandardHistoryReroll(
  [{ type: 'd6' }, { type: 'd6' }, { type: 'd8' }],
  'normal',
  false,
  4,
);
assert.deepEqual(standard, {
  kind: 'standard',
  dice: ['d6', 'd6', 'd8'],
  mode: 'normal',
  quickD20: false,
  modifier: 4,
});
assert.deepEqual(normalizeHistoryReroll(standard), standard);

const quickAdv = createStandardHistoryReroll([{ type: 'd20' }], 'advantage', true, 7);
assert.deepEqual(normalizeHistoryReroll(quickAdv), quickAdv);
const quickNormal = createStandardHistoryReroll([{ type: 'd20' }], 'normal', true, 7);
assert.deepEqual(normalizeHistoryReroll(quickNormal), quickNormal);
assert.equal(normalizeHistoryReroll({ kind: 'standard', dice: ['d7'], mode: 'normal', quickD20: false }), null);
assert.equal(normalizeHistoryReroll({ kind: 'standard', dice: ['d20'], mode: 'super', quickD20: false }), null);

const custom = createCustomHistoryReroll(37);
assert.deepEqual(custom, { kind: 'custom', sides: 37 });
assert.deepEqual(normalizeHistoryReroll(custom), custom);
assert.equal(normalizeHistoryReroll({ kind: 'custom', sides: 1 }), null);
assert.equal(normalizeHistoryReroll({ kind: 'custom', sides: 1_000_001 }), null);
assert.equal(normalizeHistoryReroll({ kind: 'shortcut', slot: {} }), null, 'Unsupported shortcut history shapes must fail closed.');

assert.equal(canRerollHistoryItem({ reroll: standard }), true);
assert.equal(canRerollHistoryItem({ formula: 'legacy' }), false);
assert.equal(
  formatHistoryItemForCopy({ formula: '2d6 + 1d8', total: '14', breakdown: 'd6: 4, 5 • d8: 5', time: '10:15:30 PM' }),
  '2d6 + 1d8 → 14\nBreakdown: d6: 4, 5 • d8: 5\nTime: 10:15:30 PM',
);
assert.equal(
  formatHistoryItemForCopy({ formula: '1d20\n<script>', total: '20', breakdown: 'safe\ttext', time: '' }).includes('\n<script>'),
  false,
  'Copied history lines must normalize embedded whitespace without interpreting markup.',
);

console.log('History record contracts passed: standard/custom rerolls preserve modifiers, normal/ADV quick D20 replay is valid, unsupported shapes fail closed, and copied history is stable plain text.');
