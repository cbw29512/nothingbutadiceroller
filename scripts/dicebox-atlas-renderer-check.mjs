import assert from 'node:assert/strict';
import {
  buildDiceBoxAtlasDrawOperations,
  renderDiceBoxAtlas,
} from '../js/appearance/dicebox-atlas-renderer.mjs';

const glyphPlan = {
  commands: [
    {
      dieType: 'd20', logicalResult: 20, strategy: 'centered-region', text: '☠', color: '#a855f7', fontId: 'fantasy',
      region: { minU: 0.1, maxU: 0.3, minV: 0.2, maxV: 0.4, centerU: 0.2, centerV: 0.3 },
    },
    {
      dieType: 'd20', logicalResult: 1, strategy: 'centered-region', text: 'FIREBALL', color: '#ffffff', fontId: null,
      region: { minU: 0.4, maxU: 0.6, minV: 0.5, maxV: 0.7, centerU: 0.5, centerV: 0.6 },
    },
    {
      dieType: 'd4', logicalResult: 1, strategy: 'tetrahedral-vertex-repeat', text: 'ᚱ', color: '#ffffff', fontId: 'runic',
      marks: [
        { u: 0.2, v: 0.2, region: { minU: 0, maxU: 0.5, minV: 0, maxV: 0.5 } },
        { u: 0.7, v: 0.2, region: { minU: 0.5, maxU: 1, minV: 0, maxV: 0.5 } },
        { u: 0.45, v: 0.75, region: { minU: 0.2, maxU: 0.7, minV: 0.5, maxV: 1 } },
      ],
    },
  ],
};

const d20 = buildDiceBoxAtlasDrawOperations(glyphPlan, 'd20', 1024);
assert.equal(d20.length, 2);
assert.equal(d20[0].x, 204.8);
assert.equal(d20[0].y, 716.8, 'Canvas Y must invert UV V to match DiceBox texture loading.');
assert.ok(d20[1].fontPx < d20[0].fontPx, 'Long words must shrink to fit the same-sized face region.');
assert.ok(d20.every((operation) => operation.maxWidth > 0 && operation.maxHeight > 0));

const d4 = buildDiceBoxAtlasDrawOperations(glyphPlan, 'd4', 1024);
assert.equal(d4.length, 3, 'A d4 logical face mark must render on three visible faces.');
assert.deepEqual(d4.map((operation) => operation.logicalResult), [1, 1, 1]);

const calls = [];
const context = {
  clearRect: (...args) => calls.push(['clearRect', ...args]),
  fillText: (...args) => calls.push(['fillText', ...args]),
  set textAlign(value) { calls.push(['textAlign', value]); },
  set textBaseline(value) { calls.push(['textBaseline', value]); },
  set fillStyle(value) { calls.push(['fillStyle', value]); },
  set font(value) { calls.push(['font', value]); },
};
const canvas = { width: 0, height: 0, getContext: () => context };
renderDiceBoxAtlas(glyphPlan, 'd20', { size: 512, canvas });
assert.equal(canvas.width, 512);
assert.equal(canvas.height, 512);
assert.equal(calls.filter(([name]) => name === 'fillText').length, 2);
assert.deepEqual(calls.find(([name]) => name === 'clearRect'), ['clearRect', 0, 0, 512, 512]);
assert.throws(() => buildDiceBoxAtlasDrawOperations(glyphPlan, 'd20', 128), /256-4096/);
console.log('DiceBox atlas renderer passed: UVs become safe pixel operations, words scale down, d4 repeats correctly, and output stays transparent except glyphs.');
