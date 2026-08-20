import assert from 'node:assert/strict';
import { SYSTEM_DEFAULT_DICE_SET_ID } from '../js/appearance/defaults.mjs';
import { getCanonicalFaceResults } from '../js/appearance/face-values.mjs';
import { createUserDiceSet } from '../js/appearance/schema.mjs';
import { prepareActiveDiceAppearance } from '../js/appearance/appearance-runtime.mjs';
import { setActiveDiceSet } from '../js/appearance/studio-persistence.mjs';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
}
function simpleMesh(name, count) {
  const positions = []; const uvs = []; const indices = [];
  for (let face = 0; face < count; face += 1) {
    const base = face * 3; positions.push(-1, 0, 0, 1, 0, 0, 0, 1, 0);
    const x = (face % 10) * 0.1; const y = Math.floor(face / 10) * 0.1;
    uvs.push(x, y, x + .09, y, x + .045, y + .09); indices.push(base, base + 1, base + 2);
  }
  return { name, positions, uvs, indices };
}
const A = [0, 1, 0]; const B = [-1, -1, 1]; const C = [1, -1, 1]; const D = [0, -1, -1];
function d4Mesh(name) {
  const positions = []; const uvs = []; const indices = [];
  [[B,C,D],[A,D,C],[A,B,D],[A,C,B]].forEach((face, faceId) => {
    const base = positions.length / 3; face.forEach((point) => positions.push(...point));
    const x = (faceId % 2) * .5; const y = Math.floor(faceId / 2) * .5;
    uvs.push(x+.25,y+.02,x+.02,y+.46,x+.48,y+.46); indices.push(base,base+1,base+2);
  });
  return { name, positions, uvs, indices };
}
function model() {
  const data = { meshes: [d4Mesh('d4'), d4Mesh('d4_collider')], colliderFaceMap: { d4: {0:1,1:2,2:3,3:4} } };
  for (const type of ['d6','d8','d10','d12','d20','d100']) {
    const results = getCanonicalFaceResults(type); data.meshes.push(simpleMesh(type, results.length), simpleMesh(`${type}_collider`, results.length));
    data.colliderFaceMap[type] = Object.fromEntries(results.map((result, faceId) => [faceId, result]));
  }
  return data;
}

const emptyStorage = memoryStorage();
let defaultLoaderCalls = 0;
const defaultRuntime = await prepareActiveDiceAppearance({ storage: emptyStorage, modelLoader: async () => { defaultLoaderCalls += 1; return model(); } });
assert.equal(defaultRuntime.mode, 'default');
assert.equal(defaultRuntime.set.id, SYSTEM_DEFAULT_DICE_SET_ID);
assert.equal(defaultRuntime.tray.color, '#000000');
assert.equal(defaultLoaderCalls, 0, 'Immutable Default must not depend on custom-theme model compilation.');

const storage = memoryStorage();
const custom = createUserDiceSet({ id: 'active_custom', ownerId: 'owner', name: 'Active Custom' });
custom.appearance.tray.color = '#123456';
setActiveDiceSet(custom, storage);
const fallback = await prepareActiveDiceAppearance({ storage, modelLoader: async () => { throw new Error('network down'); } });
assert.equal(fallback.mode, 'default');
assert.equal(fallback.tray.color, '#000000');
assert.match(fallback.reason, /network down/);

const prepared = await prepareActiveDiceAppearance({ storage, modelLoader: async () => model() });
assert.equal(prepared.mode, 'custom');
assert.equal(prepared.set.id, 'active_custom');
assert.equal(prepared.tray.color, '#123456');
assert.equal(Object.keys(prepared.runtimeThemes).length, 7);
assert.equal(Object.keys(prepared.externalThemes).length, 7);
console.log('Appearance runtime passed: Default is dependency-free, custom themes prepare separately, and every failure falls back to immutable Default Dice.');
