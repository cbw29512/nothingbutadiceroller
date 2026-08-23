import { CANONICAL_DICE } from './defaults.mjs';
import { getCanonicalFaceResults, isCanonicalFaceResult } from './face-values.mjs';
import { matchColliderFaceToRenderFace } from './dicebox-render-face-match.mjs';

function getRenderMesh(modelData, dieType) {
  const mesh = modelData?.meshes?.find((item) => item?.name === dieType);
  if (!mesh || !Array.isArray(mesh.indices) || !Array.isArray(mesh.uvs)) throw new Error(`Canonical ${dieType} render mesh is missing UV data.`);
  return mesh;
}
function getColliderMesh(modelData, dieType) { return modelData?.meshes?.find((item) => item?.name === `${dieType}_collider`) || null; }
function triangleUv(mesh, faceId) {
  const indices = mesh.indices.slice(faceId * 3, (faceId * 3) + 3);
  if (indices.length !== 3) throw new Error(`Mesh face ${faceId} has no render triangle.`);
  return indices.map((vertexIndex) => {
    const u = Number(mesh.uvs[vertexIndex * 2]); const v = Number(mesh.uvs[(vertexIndex * 2) + 1]);
    if (!Number.isFinite(u) || !Number.isFinite(v)) throw new Error(`Mesh face ${faceId} has invalid UV data.`);
    return [u, v];
  });
}
function pointKey([u, v]) { return `${u.toFixed(6)}:${v.toFixed(6)}`; }
function uniquePoints(points) {
  const seen = new Set();
  return points.filter((point) => { const key = pointKey(point); if (seen.has(key)) return false; seen.add(key); return true; });
}
function boundaryLoop(triangles) {
  const points = new Map(); const edges = new Map();
  for (const triangle of triangles) {
    for (const point of triangle) points.set(pointKey(point), point);
    for (const [a, b] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
      const aKey = pointKey(a); const bKey = pointKey(b); const key = [aKey, bKey].sort().join('|');
      const edge = edges.get(key) || { aKey, bKey, count: 0 }; edge.count += 1; edges.set(key, edge);
    }
  }
  const boundary = [...edges.values()].filter((edge) => edge.count === 1);
  if (boundary.length < 3) throw new Error('Face UV region has no closed outer boundary.');
  const adjacency = new Map();
  for (const { aKey, bKey } of boundary) {
    if (!adjacency.has(aKey)) adjacency.set(aKey, new Set()); if (!adjacency.has(bKey)) adjacency.set(bKey, new Set());
    adjacency.get(aKey).add(bKey); adjacency.get(bKey).add(aKey);
  }
  if ([...adjacency.values()].some((neighbors) => neighbors.size !== 2)) throw new Error('Face UV boundary is not a single closed perimeter.');
  const start = [...adjacency.keys()].sort()[0]; const ordered = []; let previous = null; let current = start;
  for (let guard = 0; guard <= boundary.length; guard += 1) {
    ordered.push(points.get(current)); const neighbors = [...adjacency.get(current)].sort();
    const next = neighbors.find((candidate) => candidate !== previous) || neighbors[0]; previous = current; current = next;
    if (current === start) break;
  }
  if (current !== start || ordered.length !== boundary.length) throw new Error('Face UV perimeter did not close cleanly.');
  return ordered;
}
function triangleAreaAndCentroid(points) {
  const [[u1, v1], [u2, v2], [u3, v3]] = points;
  const twiceArea = Math.abs(((u2 - u1) * (v3 - v1)) - ((u3 - u1) * (v2 - v1)));
  return { area: twiceArea / 2, centerU: (u1 + u2 + u3) / 3, centerV: (v1 + v2 + v3) / 3 };
}
function regionMetrics(points, triangles) {
  const us = points.map(([u]) => u); const vs = points.map(([, v]) => v);
  const minU = Math.min(...us); const maxU = Math.max(...us); const minV = Math.min(...vs); const maxV = Math.max(...vs);
  let totalArea = 0; let weightedU = 0; let weightedV = 0;
  for (const triangle of triangles) {
    const metrics = triangleAreaAndCentroid(triangle); if (metrics.area <= Number.EPSILON) continue;
    totalArea += metrics.area; weightedU += metrics.centerU * metrics.area; weightedV += metrics.centerV * metrics.area;
  }
  return {
    minU, maxU, minV, maxV,
    centerU: totalArea > Number.EPSILON ? weightedU / totalArea : (minU + maxU) / 2,
    centerV: totalArea > Number.EPSILON ? weightedV / totalArea : (minV + maxV) / 2,
  };
}

export function extractDiceBoxFaceRegions(modelData, dieType, { includeOutline = false } = {}) {
  try {
    if (!Object.hasOwn(CANONICAL_DICE, dieType)) throw new Error(`Unsupported die type: ${dieType}`);
    const mesh = getRenderMesh(modelData, dieType); const colliderMesh = getColliderMesh(modelData, dieType);
    const colliderMap = modelData?.colliderFaceMap?.[dieType];
    if (!colliderMap || typeof colliderMap !== 'object') throw new Error(`Canonical ${dieType} colliderFaceMap is missing.`);
    const grouped = new Map(); const usedD20RenderFaces = new Set();
    for (const [rawFaceId, rawResult] of Object.entries(colliderMap)) {
      const faceId = Number(rawFaceId); const logicalResult = Number(rawResult);
      if (!Number.isInteger(faceId) || !isCanonicalFaceResult(dieType, logicalResult)) throw new Error(`${dieType} collider mapping contains an invalid face.`);
      const renderFaceId = dieType === 'd20' && colliderMesh ? matchColliderFaceToRenderFace(mesh, colliderMesh, faceId, usedD20RenderFaces) : faceId;
      const triangles = grouped.get(logicalResult) || []; triangles.push(triangleUv(mesh, renderFaceId)); grouped.set(logicalResult, triangles);
    }
    const expected = getCanonicalFaceResults(dieType);
    if (grouped.size !== expected.length || expected.some((result) => !grouped.has(result))) throw new Error(`${dieType} collider mapping does not cover every physical result.`);
    return Object.fromEntries(expected.map((logicalResult) => {
      const triangles = grouped.get(logicalResult); const points = uniquePoints(triangles.flat());
      return [String(logicalResult), {
        logicalResult, points, ...regionMetrics(points, triangles),
        ...(includeOutline ? { outline: boundaryLoop(triangles) } : {}),
      }];
    }));
  } catch (error) {
    console.error('Failed to extract DiceBox face UV regions:', error); throw error;
  }
}
