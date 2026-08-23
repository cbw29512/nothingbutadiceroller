import assert from 'node:assert/strict';
import { expandCoplanarRenderFace } from '../js/appearance/dicebox-face-expansion.mjs';

function meshFromTriangles(triangles) {
  const positions = []; const indices = [];
  for (const triangle of triangles) {
    const base = positions.length / 3;
    triangle.forEach((point) => positions.push(...point));
    indices.push(base, base + 1, base + 2);
  }
  return { positions, indices };
}

const d8Seed = [[0, 0, 0], [1, 0, 0], [0.5, 1, 0]];
const d8Extra = [[0, 0, 0], [1, 0, 0], [0.5, -1, 0]];
const d8Mesh = meshFromTriangles([d8Seed, d8Extra]);
assert.deepEqual(
  expandCoplanarRenderFace(d8Mesh, [0], 'd8', 1),
  [0],
  'A triangular canonical face must stop at its valid seed instead of absorbing extra coplanar neighbors.',
);

const pentagon = Array.from({ length: 5 }, (_, index) => {
  const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / 5);
  return [Math.cos(angle), Math.sin(angle), 0];
});
const d12Mesh = meshFromTriangles([
  [pentagon[0], pentagon[1], pentagon[2]],
  [pentagon[0], pentagon[2], pentagon[3]],
  [pentagon[0], pentagon[3], pentagon[4]],
]);
assert.deepEqual(
  expandCoplanarRenderFace(d12Mesh, [0], 'd12', 1),
  [0, 1, 2],
  'A pentagonal d12 face must grow only until its three-triangle patch exposes five outer edges.',
);

const quad = [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]];
const d6Mesh = meshFromTriangles([[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]);
assert.deepEqual(expandCoplanarRenderFace(d6Mesh, [0], 'd6', 1), [0, 1]);

assert.throws(
  () => expandCoplanarRenderFace(meshFromTriangles([d8Seed]), [0], 'd12', 1),
  /could not reconstruct an exact 5-edge canonical render face/,
  'Incomplete geometry must fail closed rather than invent missing physical edges.',
);

console.log('DiceBox face expansion passed: triangular faces stop immediately, quad/pentagon faces grow minimally across shared coplanar edges, and incomplete geometry fails closed.');
