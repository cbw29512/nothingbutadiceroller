import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getCanonicalFaceResults } from '../js/appearance/face-values.mjs';
import {
  APPEARANCE_DICEBOX_VERSION,
  CANONICAL_MODEL_URLS,
  loadCanonicalDiceBoxModel,
  normalizeCanonicalDiceBoxModel,
} from '../js/appearance/dicebox-model-loader.mjs';

function baseModel() {
  const model = { meshes: [], colliderFaceMap: {} };
  for (const type of ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']) {
    model.meshes.push({ name: type, id: type }, { name: `${type}_collider`, id: `${type}_collider` });
    model.colliderFaceMap[type] = Object.fromEntries(getCanonicalFaceResults(type).map((result, faceId) => [faceId, result]));
  }
  return model;
}

const raw = baseModel();
const normalized = normalizeCanonicalDiceBoxModel(raw);
assert.equal(raw.meshes.some((mesh) => mesh.name === 'd100'), false, 'Normalizer must not mutate upstream model input.');
assert.ok(normalized.meshes.some((mesh) => mesh.name === 'd100'));
assert.ok(normalized.meshes.some((mesh) => mesh.name === 'd100_collider'));
assert.deepEqual(
  [...new Set(Object.values(normalized.colliderFaceMap.d100))].sort((a, b) => a - b),
  [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
);

let calls = 0;
const fakeFetch = async (url) => {
  calls += 1;
  if (calls === 1) return { ok: false, status: 503, json: async () => ({}) };
  assert.equal(url, CANONICAL_MODEL_URLS[1]);
  return { ok: true, status: 200, json: async () => baseModel() };
};
const loaded = await loadCanonicalDiceBoxModel(fakeFetch);
assert.equal(calls, 2, 'Canonical model loader must fall back to the second pinned CDN source.');
assert.ok(loaded.colliderFaceMap.d100);

const bad = baseModel();
bad.colliderFaceMap.d20[0] = 99;
assert.throws(() => normalizeCanonicalDiceBoxModel(bad), /standard physical die/);
const physicsSource = await readFile(new URL('../js/physics.js', import.meta.url), 'utf8');
assert.ok(physicsSource.includes(`DICEBOX_VERSION = '${APPEARANCE_DICEBOX_VERSION}'`), 'Appearance compiler and live DiceBox must stay pinned to the same version.');
console.log(`DiceBox model loader passed: version ${APPEARANCE_DICEBOX_VERSION} pinned, CDN fallback works, and d100 mirrors DiceBox's standard d10 percentile fallback.`);
