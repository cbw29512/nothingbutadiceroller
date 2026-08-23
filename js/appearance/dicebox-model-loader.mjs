import { CANONICAL_DICE } from './defaults.mjs';
import { getCanonicalFaceResults } from './face-values.mjs';
import { APPEARANCE_DICEBOX_VERSION, DICEBOX_DEFAULT_MODEL_URL } from './dicebox-self-host.mjs';

export { APPEARANCE_DICEBOX_VERSION };
export const CANONICAL_MODEL_URLS = Object.freeze([DICEBOX_DEFAULT_MODEL_URL]);

let cachedModelPromise = null;
function clone(value) { return structuredClone(value); }
function meshByName(modelData, name) { return modelData.meshes?.find((mesh) => mesh?.name === name) || null; }

function synthesizePercentile(modelData) {
  if (meshByName(modelData, 'd100') && modelData.colliderFaceMap?.d100) return;
  const d10 = meshByName(modelData, 'd10');
  const collider = meshByName(modelData, 'd10_collider');
  const map = modelData.colliderFaceMap?.d10;
  if (!d10 || !collider || !map) throw new Error('Canonical d10 data is required to synthesize d100.');
  const d100 = clone(d10); d100.name = 'd100'; d100.id = 'd100';
  const d100Collider = clone(collider); d100Collider.name = 'd100_collider'; d100Collider.id = 'd100_collider';
  modelData.meshes.push(d100, d100Collider);
  modelData.colliderFaceMap.d100 = Object.fromEntries(Object.entries(map).map(([faceId, rawValue]) => {
    const value = Number(rawValue);
    return [faceId, value === 10 ? 0 : value * 10];
  }));
}

export function normalizeCanonicalDiceBoxModel(rawModelData) {
  try {
    const modelData = clone(rawModelData);
    if (!modelData || !Array.isArray(modelData.meshes) || !modelData.colliderFaceMap) throw new Error('DiceBox model data is incomplete.');
    synthesizePercentile(modelData);
    for (const type of Object.keys(CANONICAL_DICE)) {
      const render = meshByName(modelData, type);
      const collider = meshByName(modelData, `${type}_collider`);
      const map = modelData.colliderFaceMap[type];
      if (!render || !collider || !map) throw new Error(`Canonical ${type} model data is incomplete.`);
      const actual = [...new Set(Object.values(map).map(Number))].sort((a, b) => a - b);
      const expected = getCanonicalFaceResults(type).sort((a, b) => a - b);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${type} collider results do not match the standard physical die.`);
    }
    return modelData;
  } catch (error) {
    console.error('Failed to normalize canonical DiceBox model:', error);
    throw error;
  }
}

async function fetchModel(fetchImpl) {
  const url = CANONICAL_MODEL_URLS[0];
  try {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalizeCanonicalDiceBoxModel(await response.json());
  } catch (error) {
    throw new Error(`Unable to load self-hosted canonical DiceBox ${APPEARANCE_DICEBOX_VERSION} model from ${url}. ${error?.message || error}`);
  }
}

export function loadCanonicalDiceBoxModel(fetchImpl = fetch) {
  if (fetchImpl !== globalThis.fetch) return fetchModel(fetchImpl);
  cachedModelPromise ||= fetchModel(fetchImpl).catch((error) => { cachedModelPromise = null; throw error; });
  return cachedModelPromise;
}
