import assert from 'node:assert/strict';
import { extractDiceBoxFaceRegions } from '../js/appearance/dicebox-atlas-layout.mjs';

function syntheticMesh(name, faceCount) {
  const indices = [];
  const uvs = [];
  for (let face = 0; face < faceCount; face += 1) {
    const base = face * 3;
    indices.push(base, base + 1, base + 2);
    const x = (face % 5) * 0.1;
    const y = Math.floor(face / 5) * 0.1;
    uvs.push(x, y, x + 0.08, y, x + 0.04, y + 0.08);
  }
  return { name, indices, uvs };
}

const d6Map = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6 };
const d6Model = { meshes: [syntheticMesh('d6', 12)], colliderFaceMap: { d6: d6Map } };
const d6 = extractDiceBoxFaceRegions(d6Model, 'd6');
assert.deepEqual(Object.keys(d6), ['1', '2', '3', '4', '5', '6']);
assert.equal(d6['1'].points.length, 6, 'Two collider triangles should combine into one square-face UV region.');

const d20Map = Object.fromEntries(Array.from({ length: 20 }, (_, faceId) => [faceId, faceId + 1]));
const d20Model = { meshes: [syntheticMesh('d20', 20)], colliderFaceMap: { d20: d20Map } };
const d20 = extractDiceBoxFaceRegions(d20Model, 'd20');
assert.ok(Math.abs(d20['1'].centerU - 0.04) < 1e-12, 'd20 glyph U anchor must use the triangle centroid.');
assert.ok(Math.abs(d20['1'].centerV - (0.08 / 3)) < 1e-12, 'd20 glyph V anchor must use the triangle centroid, not the bounding-box midpoint.');
assert.notEqual(d20['1'].centerV, 0.04, 'Triangle centering must not regress to the bounding-box midpoint.');

const percentileResults = [10, 10, 20, 20, 30, 30, 40, 40, 50, 50, 60, 60, 70, 70, 80, 80, 90, 90, 0, 0];
const d100Map = Object.fromEntries(percentileResults.map((result, faceId) => [faceId, result]));
const d100Model = { meshes: [syntheticMesh('d100', 20)], colliderFaceMap: { d100: d100Map } };
const d100 = extractDiceBoxFaceRegions(d100Model, 'd100');
assert.deepEqual(Object.keys(d100).map(Number).sort((a, b) => a - b), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
assert.equal(Object.keys(d100).length, 10, 'Percentile die must expose ten physical faces, never 100 imaginary faces.');

const invalid = structuredClone(d100Model);
invalid.colliderFaceMap.d100[0] = 100;
assert.throws(() => extractDiceBoxFaceRegions(invalid, 'd100'));
console.log('DiceBox atlas layout passed: UV regions use area-weighted face centroids and immutable collider result mappings, including triangular d20 and percentile faces.');
