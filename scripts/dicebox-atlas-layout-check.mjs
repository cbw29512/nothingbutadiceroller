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

function pushTriangle(mesh, centerX, size, uv) {
  const base = mesh.positions.length / 3;
  mesh.indices.push(base, base + 1, base + 2);
  mesh.positions.push(
    centerX - size, -size, 0,
    centerX + size, -size, 0,
    centerX, size, 0,
  );
  mesh.uvs?.push(...uv);
}

function d20GeometryModel() {
  const render = { name: 'd20', indices: [], positions: [], uvs: [] };
  const collider = { name: 'd20_collider', indices: [], positions: [] };
  for (let face = 0; face < 19; face += 1) {
    const centerX = face * 4;
    const x = (face % 5) * 0.1;
    const y = Math.floor(face / 5) * 0.1;
    pushTriangle(render, centerX, 0.9, [x, y, x + 0.08, y, x + 0.04, y + 0.08]);
    pushTriangle(collider, centerX, 1, null);
  }

  // DiceBox's beveled render mesh is not guaranteed to keep collider face IDs and
  // primary render-triangle IDs aligned. Simulate the observed d20 failure: the
  // ordinal triangle is a tiny bevel, while the real face artwork triangle is later.
  const finalCenter = 19 * 4;
  pushTriangle(render, finalCenter, 0.05, [0.7, 0.7, 0.701, 0.7, 0.7005, 0.704]);
  pushTriangle(render, finalCenter, 0.9, [0.5, 0.7, 0.58, 0.7, 0.54, 0.78]);
  pushTriangle(collider, finalCenter, 1, null);

  const map = Object.fromEntries(Array.from({ length: 20 }, (_, faceId) => [faceId, faceId + 1]));
  return { meshes: [render, collider], colliderFaceMap: { d20: map } };
}

const d6Map = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6 };
const d6Model = { meshes: [syntheticMesh('d6', 12)], colliderFaceMap: { d6: d6Map } };
const d6 = extractDiceBoxFaceRegions(d6Model, 'd6');
assert.deepEqual(Object.keys(d6), ['1', '2', '3', '4', '5', '6']);
assert.equal(d6['1'].points.length, 6, 'Two collider triangles should combine into one square-face UV region.');

const d20 = extractDiceBoxFaceRegions(d20GeometryModel(), 'd20');
assert.ok(Math.abs(d20['1'].centerU - 0.04) < 1e-12, 'd20 glyph U anchor must use the triangle centroid.');
assert.ok(Math.abs(d20['1'].centerV - (0.08 / 3)) < 1e-12, 'd20 glyph V anchor must use the triangle centroid, not the bounding-box midpoint.');
assert.notEqual(d20['1'].centerV, 0.04, 'Triangle centering must not regress to the bounding-box midpoint.');
assert.ok(d20['20'].maxU - d20['20'].minU > 0.05,
  'A d20 collider face must resolve to its full-size render face instead of a tiny bevel triangle.');
assert.ok(Math.abs(d20['20'].centerU - 0.54) < 1e-12 && Math.abs(d20['20'].centerV - (0.7 + (0.08 / 3))) < 1e-12,
  'The displaced final d20 face must use the later geometry-matched render triangle.');

const percentileResults = [10, 10, 20, 20, 30, 30, 40, 40, 50, 50, 60, 60, 70, 70, 80, 80, 90, 90, 0, 0];
const d100Map = Object.fromEntries(percentileResults.map((result, faceId) => [faceId, result]));
const d100Model = { meshes: [syntheticMesh('d100', 20)], colliderFaceMap: { d100: d100Map } };
const d100 = extractDiceBoxFaceRegions(d100Model, 'd100');
assert.deepEqual(Object.keys(d100).map(Number).sort((a, b) => a - b), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
assert.equal(Object.keys(d100).length, 10, 'Percentile die must expose ten physical faces, never 100 imaginary faces.');

const invalid = structuredClone(d100Model);
invalid.colliderFaceMap.d100[0] = 100;
assert.throws(() => extractDiceBoxFaceRegions(invalid, 'd100'));
console.log('DiceBox atlas layout passed: d20 collider faces resolve to full-size render triangles, centroids stay centered, and percentile mappings remain immutable.');
