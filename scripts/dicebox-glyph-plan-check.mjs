import assert from 'node:assert/strict';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { replaceVisualFace } from '../js/appearance/face-customization.mjs';
import { buildAppearanceRenderPlan } from '../js/appearance/render-plan.mjs';
import { buildDiceBoxGlyphPlan } from '../js/appearance/dicebox-glyph-plan.mjs';
import { getCanonicalFaceResults } from '../js/appearance/face-values.mjs';

function triangularMesh(name, count) {
  const positions = []; const uvs = []; const indices = [];
  for (let face = 0; face < count; face += 1) {
    const base = face * 3;
    positions.push(-1, 0, 0, 1, 0, 0, 0, 1, 0);
    const x = (face % 10) * 0.1; const y = Math.floor(face / 10) * 0.1;
    uvs.push(x, y, x + 0.09, y, x + 0.045, y + 0.09);
    indices.push(base, base + 1, base + 2);
  }
  return { name, positions, uvs, indices };
}
const A = [0, 1, 0]; const B = [-1, -1, 1]; const C = [1, -1, 1]; const D = [0, -1, -1];
const d4Faces = [[B, C, D], [A, D, C], [A, B, D], [A, C, B]];
function d4Mesh(name) {
  const positions = []; const uvs = []; const indices = [];
  d4Faces.forEach((face, faceId) => {
    const base = positions.length / 3; face.forEach((position) => positions.push(...position));
    const x = (faceId % 2) * 0.5; const y = Math.floor(faceId / 2) * 0.5;
    uvs.push(x + 0.25, y + 0.02, x + 0.02, y + 0.46, x + 0.48, y + 0.46); indices.push(base, base + 1, base + 2);
  });
  return { name, positions, uvs, indices };
}
const modelData = { meshes: [d4Mesh('d4'), d4Mesh('d4_collider')], colliderFaceMap: { d4: { 0: 1, 1: 2, 2: 3, 3: 4 } } };
for (const type of ['d6', 'd8', 'd10', 'd12', 'd20', 'd100']) {
  const results = getCanonicalFaceResults(type); modelData.meshes.push(triangularMesh(type, results.length));
  modelData.colliderFaceMap[type] = Object.fromEntries(results.map((result, faceId) => [faceId, result]));
}
let set = createUserDiceSet({ id: 'glyphs', ownerId: 'owner', name: 'Glyph Test' });
set = replaceVisualFace(set, 'd20', 20, { kind: 'icon', value: 'skull', color: '#a855f7', scale: 1.2 });
set = replaceVisualFace(set, 'd4', 1, { kind: 'text', value: 'ᚱ', color: '#ffffff', scale: 0.6 });
set = replaceVisualFace(set, 'd100', 90, { kind: 'text', value: 'MAX', color: '#ffff00' });
const glyphs = buildDiceBoxGlyphPlan(buildAppearanceRenderPlan(set), modelData);
const command = (type, result) => glyphs.commands.find((item) => item.dieType === type && item.logicalResult === result);
assert.equal(command('d20', 20).text, '☠'); assert.equal(command('d20', 20).color, '#a855f7'); assert.equal(command('d20', 20).scale, 1.2);
assert.equal(command('d20', 19).text, '19'); assert.equal(command('d20', 19).scale, 1, 'Untouched faces must compile at the 100% default.');
assert.equal(command('d10', 10).text, '0');
assert.equal(command('d100', 0).text, '00'); assert.equal(command('d100', 90).text, 'MAX'); assert.equal(command('d100', 90).scale, 1);
assert.equal(command('d100', 90).logicalResult, 90, 'The word MAX must remain visual artwork over logical result 90.');
assert.equal(command('d4', 1).strategy, 'tetrahedral-vertex-repeat'); assert.equal(command('d4', 1).text, 'ᚱ'); assert.equal(command('d4', 1).scale, 0.6); assert.equal(command('d4', 1).marks.length, 3);
assert.equal(glyphs.commands.length, 70); assert.equal('roll' in glyphs, false); assert.equal('result' in glyphs, false);
console.log('DiceBox glyph plan passed: canonical labels, short words/symbols, bounded per-face glyph scale, percentile faces, and d4 markings stay visual-only.');
