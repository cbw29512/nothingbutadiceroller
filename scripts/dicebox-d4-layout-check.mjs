import assert from 'node:assert/strict';
import { extractD4VertexAnchors } from '../js/appearance/dicebox-d4-layout.mjs';

const A = [0, 1, 0];
const B = [-1, -1, 1];
const C = [1, -1, 1];
const D = [0, -1, -1];
const faces = [[B, C, D], [A, D, C], [A, B, D], [A, C, B]];

function tetraMesh(name) {
  const positions = [];
  const uvs = [];
  const indices = [];
  faces.forEach((face, faceId) => {
    const base = positions.length / 3;
    face.forEach((position) => positions.push(...position));
    const x = (faceId % 2) * 0.5;
    const y = Math.floor(faceId / 2) * 0.5;
    uvs.push(x + 0.25, y + 0.02, x + 0.02, y + 0.46, x + 0.48, y + 0.46);
    indices.push(base, base + 1, base + 2);
  });
  return { name, positions, uvs, indices };
}

const model = {
  meshes: [tetraMesh('d4'), tetraMesh('d4_collider')],
  colliderFaceMap: { d4: { 0: 1, 1: 2, 2: 3, 3: 4 } },
};
const anchors = extractD4VertexAnchors(model);
assert.deepEqual(Object.keys(anchors), ['1', '2', '3', '4']);
for (const result of [1, 2, 3, 4]) {
  const marks = anchors[String(result)].marks;
  assert.equal(marks.length, 3, `d4 result ${result} must repeat around three visible faces.`);
  assert.equal(new Set(marks.map((mark) => mark.faceId)).size, 3);
  marks.forEach((mark) => {
    assert.ok(mark.u > 0 && mark.u < 1, 'd4 U anchor should be inset from the texture edge.');
    assert.ok(mark.v > 0 && mark.v < 1, 'd4 V anchor should be inset from the texture edge.');
    assert.equal(mark.region.outline.length, 3, 'Each canonical d4 render face must expose its true triangular UV perimeter.');
    assert.ok(mark.region.outline.every((point) => Array.isArray(point) && point.length === 2));
  });
}
assert.deepEqual(anchors['1'].marks.map((mark) => mark.faceId).sort(), [1, 2, 3]);
console.log('DiceBox d4 layout passed: each result repeats around three visible faces and every render triangle exposes a true UV perimeter for edge inlays.');
