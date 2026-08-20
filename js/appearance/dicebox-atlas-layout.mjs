import { CANONICAL_DICE } from './defaults.mjs';
import { getCanonicalFaceResults, isCanonicalFaceResult } from './face-values.mjs';

function getRenderMesh(modelData, dieType) {
  const mesh = modelData?.meshes?.find((item) => item?.name === dieType);
  if (!mesh || !Array.isArray(mesh.indices) || !Array.isArray(mesh.uvs)) {
    throw new Error(`Canonical ${dieType} render mesh is missing UV data.`);
  }
  return mesh;
}

function triangleUv(mesh, faceId) {
  const offset = faceId * 3;
  const indices = mesh.indices.slice(offset, offset + 3);
  if (indices.length !== 3) throw new Error(`Mesh face ${faceId} has no render triangle.`);
  return indices.map((vertexIndex) => {
    const u = Number(mesh.uvs[vertexIndex * 2]);
    const v = Number(mesh.uvs[(vertexIndex * 2) + 1]);
    if (!Number.isFinite(u) || !Number.isFinite(v)) throw new Error(`Mesh face ${faceId} has invalid UV data.`);
    return [u, v];
  });
}

function uniquePoints(points) {
  const seen = new Set();
  return points.filter(([u, v]) => {
    const key = `${u.toFixed(6)}:${v.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function regionMetrics(points) {
  const us = points.map(([u]) => u);
  const vs = points.map(([, v]) => v);
  const minU = Math.min(...us); const maxU = Math.max(...us);
  const minV = Math.min(...vs); const maxV = Math.max(...vs);
  return { minU, maxU, minV, maxV, centerU: (minU + maxU) / 2, centerV: (minV + maxV) / 2 };
}

export function extractDiceBoxFaceRegions(modelData, dieType) {
  try {
    if (!Object.hasOwn(CANONICAL_DICE, dieType)) throw new Error(`Unsupported die type: ${dieType}`);
    const mesh = getRenderMesh(modelData, dieType);
    const colliderMap = modelData?.colliderFaceMap?.[dieType];
    if (!colliderMap || typeof colliderMap !== 'object') throw new Error(`Canonical ${dieType} colliderFaceMap is missing.`);
    const grouped = new Map();
    for (const [rawFaceId, rawResult] of Object.entries(colliderMap)) {
      const faceId = Number(rawFaceId); const logicalResult = Number(rawResult);
      if (!Number.isInteger(faceId) || !isCanonicalFaceResult(dieType, logicalResult)) {
        throw new Error(`${dieType} collider mapping contains an invalid face.`);
      }
      const points = grouped.get(logicalResult) || [];
      points.push(...triangleUv(mesh, faceId));
      grouped.set(logicalResult, points);
    }
    const expected = getCanonicalFaceResults(dieType);
    if (grouped.size !== expected.length || expected.some((result) => !grouped.has(result))) {
      throw new Error(`${dieType} collider mapping does not cover every physical result.`);
    }
    return Object.fromEntries(expected.map((logicalResult) => {
      const points = uniquePoints(grouped.get(logicalResult));
      return [String(logicalResult), { logicalResult, points, ...regionMetrics(points) }];
    }));
  } catch (error) {
    console.error('Failed to extract DiceBox face UV regions:', error);
    throw error;
  }
}
