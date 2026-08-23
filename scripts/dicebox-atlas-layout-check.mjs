import assert from 'node:assert/strict';
import { extractDiceBoxFaceRegions } from '../js/appearance/dicebox-atlas-layout.mjs';

function pushTriangle(mesh, centerX, size, uv) {
  const base = mesh.positions.length / 3;
  mesh.indices.push(base, base + 1, base + 2);
  mesh.positions.push(centerX - size, -size, 0, centerX + size, -size, 0, centerX, size, 0);
  mesh.uvs?.push(...uv);
}

function d20GeometryModel() {
  const render = { name: 'd20', indices: [], positions: [], uvs: [] };
  const collider = { name: 'd20_collider', indices: [], positions: [] };
  for (let face = 0; face < 19; face += 1) {
    const centerX = face * 4; const x = (face % 5) * 0.1; const y = Math.floor(face / 5) * 0.1;
    pushTriangle(render, centerX, 0.9, [x, y, x + 0.08, y, x + 0.04, y + 0.08]);
    pushTriangle(collider, centerX, 1, null);
  }
  const finalCenter = 19 * 4;
  pushTriangle(render, finalCenter, 0.05, [0.7, 0.7, 0.701, 0.7, 0.7005, 0.704]);
  pushTriangle(render, finalCenter, 0.9, [0.5, 0.7, 0.58, 0.7, 0.54, 0.78]);
  pushTriangle(collider, finalCenter, 1, null);
  return { meshes: [render, collider], colliderFaceMap: { d20: Object.fromEntries(Array.from({ length: 20 }, (_, id) => [id, id + 1])) } };
}

function connectedQuadModel(name, results) {
  const mesh = { name, indices: [], uvs: [] }; const map = {};
  results.forEach((result, faceIndex) => {
    const base = mesh.uvs.length / 2;
    const x = (faceIndex % 5) * 0.19; const y = Math.floor(faceIndex / 5) * 0.44;
    mesh.uvs.push(x, y, x + 0.16, y, x + 0.16, y + 0.18, x, y + 0.18);
    mesh.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    map[faceIndex * 2] = result; map[(faceIndex * 2) + 1] = result;
  });
  return { meshes: [mesh], colliderFaceMap: { [name]: map } };
}

const d6 = extractDiceBoxFaceRegions(connectedQuadModel('d6', [1, 2, 3, 4, 5, 6]), 'd6');
assert.deepEqual(Object.keys(d6), ['1', '2', '3', '4', '5', '6']);
assert.equal(d6['1'].points.length, 4, 'Two render triangles should resolve to four unique square corners.');
assert.equal(d6['1'].outline.length, 4, 'Shared internal triangle diagonals must be removed from the physical face perimeter.');
const outlineKeys = new Set(d6['1'].outline.map(([u, v]) => `${u.toFixed(3)}:${v.toFixed(3)}`));
assert.deepEqual(outlineKeys, new Set(['0.000:0.000', '0.160:0.000', '0.160:0.180', '0.000:0.180']));

const d20 = extractDiceBoxFaceRegions(d20GeometryModel(), 'd20');
assert.ok(Math.abs(d20['1'].centerU - 0.04) < 1e-12, 'd20 glyph U anchor must use the triangle centroid.');
assert.ok(Math.abs(d20['1'].centerV - (0.08 / 3)) < 1e-12, 'd20 glyph V anchor must use the triangle centroid, not the bounding-box midpoint.');
assert.equal(d20['1'].outline.length, 3, 'Triangular d20 physical faces must expose three true UV perimeter edges.');
assert.ok(d20['20'].maxU - d20['20'].minU > 0.05, 'A d20 collider face must resolve to its full-size render face instead of a tiny bevel triangle.');
assert.ok(Math.abs(d20['20'].centerU - 0.54) < 1e-12 && Math.abs(d20['20'].centerV - (0.7 + (0.08 / 3))) < 1e-12,
  'The displaced final d20 face must use the later geometry-matched render triangle.');

const percentile = [10, 20, 30, 40, 50, 60, 70, 80, 90, 0];
const d100 = extractDiceBoxFaceRegions(connectedQuadModel('d100', percentile), 'd100');
assert.deepEqual(Object.keys(d100).map(Number).sort((a, b) => a - b), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
assert.equal(Object.keys(d100).length, 10, 'Percentile die must expose ten physical faces, never 100 imaginary faces.');
assert.equal(d100['10'].outline.length, 4, 'Percentile face triangulation must collapse to one connected outer perimeter.');

const invalid = connectedQuadModel('d100', percentile);
invalid.colliderFaceMap.d100[0] = 100;
assert.throws(() => extractDiceBoxFaceRegions(invalid, 'd100'));
console.log('DiceBox atlas layout passed: exact outer UV perimeters remove internal seams, d20 geometry matching stays correct, centroids stay centered, and percentile mappings remain immutable.');
