import { CANONICAL_DICE } from './defaults.mjs';
import { getCanonicalFaceResults, isCanonicalFaceResult } from './face-values.mjs';
import { CANONICAL_FACE_EDGE_COUNTS, expandCoplanarRenderFace } from './dicebox-face-expansion.mjs';
import { matchColliderFaceToRenderFace } from './dicebox-render-face-match.mjs';

function getRenderMesh(modelData, dieType) {
  const mesh = modelData?.meshes?.find((item) => item?.name === dieType);
  if (!mesh || !Array.isArray(mesh.indices) || !Array.isArray(mesh.uvs)) throw new Error(`Canonical ${dieType} render mesh is missing UV data.`);
  return mesh;
}
function getColliderMesh(modelData, dieType) { return modelData?.meshes?.find((item) => item?.name === `${dieType}_collider`) || null; }
function vertexPosition(mesh, vertexIndex) {
  if (!Array.isArray(mesh.positions)) return null;
  const point = [Number(mesh.positions[vertexIndex * 3]), Number(mesh.positions[(vertexIndex * 3) + 1]), Number(mesh.positions[(vertexIndex * 3) + 2])];
  return point.every(Number.isFinite) ? point : null;
}
function triangleData(mesh, faceId) {
  const indices = mesh.indices.slice(faceId * 3, (faceId * 3) + 3);
  if (indices.length !== 3) throw new Error(`Mesh face ${faceId} has no render triangle.`);
  return indices.map((vertexIndex) => {
    const u = Number(mesh.uvs[vertexIndex * 2]); const v = Number(mesh.uvs[(vertexIndex * 2) + 1]);
    if (!Number.isFinite(u) || !Number.isFinite(v)) throw new Error(`Mesh face ${faceId} has invalid UV data.`);
    return { uv: [u, v], position: vertexPosition(mesh, vertexIndex) };
  });
}
function uvKey([u, v]) { return `${u.toFixed(6)}:${v.toFixed(6)}`; }
function physicalKey(vertex) {
  if (vertex.position) return vertex.position.map((value) => Number(value).toFixed(5)).join(':');
  return `uv:${uvKey(vertex.uv)}`;
}
function uniqueUvPoints(triangles) {
  const seen = new Set(); const result = [];
  for (const vertex of triangles.flat()) {
    const key = uvKey(vertex.uv); if (seen.has(key)) continue; seen.add(key); result.push(vertex.uv);
  }
  return result;
}
function triangleUvCenter(triangle) {
  return [triangle.reduce((sum, vertex) => sum + vertex.uv[0], 0) / 3, triangle.reduce((sum, vertex) => sum + vertex.uv[1], 0) / 3];
}
function validUvEdge(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-8; }
function edgeSegments(triangles, dieType, logicalResult) {
  const edges = new Map();
  for (const triangle of triangles) {
    const insideUv = triangleUvCenter(triangle);
    for (const [a, b] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
      const aKey = physicalKey(a); const bKey = physicalKey(b);
      if (aKey === bKey) throw new Error(`${dieType} face ${logicalResult} contains a zero-length physical edge.`);
      const key = [aKey, bKey].sort().join('|');
      const edge = edges.get(key) || { key, uvA: a.uv, uvB: b.uv, insideUv, count: 0 };
      edge.count += 1;
      if (edge.count > 2) throw new Error(`${dieType} face ${logicalResult} contains a non-manifold physical edge.`);
      edges.set(key, edge);
    }
  }
  const boundary = [...edges.values()].filter((edge) => edge.count === 1).sort((a, b) => a.key.localeCompare(b.key));
  const expected = CANONICAL_FACE_EDGE_COUNTS[dieType];
  if (!Number.isInteger(expected)) throw new Error(`No physical edge-count contract exists for ${dieType}.`);
  if (boundary.length !== expected) throw new Error(`${dieType} face ${logicalResult} must expose ${expected} physical outer edges; found ${boundary.length}.`);
  if (boundary.some(({ uvA, uvB }) => !validUvEdge(uvA, uvB))) throw new Error(`${dieType} face ${logicalResult} contains a zero-length UV edge.`);
  return boundary.map(({ uvA, uvB, insideUv }) => [uvA, uvB, insideUv]);
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
    const metrics = triangleAreaAndCentroid(triangle.map((vertex) => vertex.uv)); if (metrics.area <= Number.EPSILON) continue;
    totalArea += metrics.area; weightedU += metrics.centerU * metrics.area; weightedV += metrics.centerV * metrics.area;
  }
  return { minU, maxU, minV, maxV, centerU: totalArea > Number.EPSILON ? weightedU / totalArea : (minU + maxU) / 2, centerV: totalArea > Number.EPSILON ? weightedV / totalArea : (minV + maxV) / 2 };
}

export function extractDiceBoxFaceRegions(modelData, dieType, { includeEdgeSegments = false } = {}) {
  try {
    if (!Object.hasOwn(CANONICAL_DICE, dieType)) throw new Error(`Unsupported die type: ${dieType}`);
    const mesh = getRenderMesh(modelData, dieType); const colliderMesh = getColliderMesh(modelData, dieType);
    const colliderMap = modelData?.colliderFaceMap?.[dieType];
    if (!colliderMap || typeof colliderMap !== 'object') throw new Error(`Canonical ${dieType} colliderFaceMap is missing.`);
    const seedsByResult = new Map(); const usedRenderFaces = new Set();
    for (const [rawFaceId, rawResult] of Object.entries(colliderMap)) {
      const faceId = Number(rawFaceId); const logicalResult = Number(rawResult);
      if (!Number.isInteger(faceId) || !isCanonicalFaceResult(dieType, logicalResult)) throw new Error(`${dieType} collider mapping contains an invalid face.`);
      const needsGeometryMatch = Boolean(colliderMesh && (dieType === 'd20' || includeEdgeSegments));
      const renderFaceId = needsGeometryMatch ? matchColliderFaceToRenderFace(mesh, colliderMesh, faceId, usedRenderFaces) : faceId;
      const seeds = seedsByResult.get(logicalResult) || []; seeds.push(renderFaceId); seedsByResult.set(logicalResult, seeds);
    }
    const expected = getCanonicalFaceResults(dieType);
    if (seedsByResult.size !== expected.length || expected.some((result) => !seedsByResult.has(result))) throw new Error(`${dieType} collider mapping does not cover every physical result.`);
    return Object.fromEntries(expected.map((logicalResult) => {
      const seeds = seedsByResult.get(logicalResult);
      const faceIds = includeEdgeSegments && colliderMesh ? expandCoplanarRenderFace(mesh, seeds, dieType, logicalResult) : seeds;
      const triangles = faceIds.map((faceId) => triangleData(mesh, faceId)); const points = uniqueUvPoints(triangles);
      return [String(logicalResult), { logicalResult, points, ...regionMetrics(points, triangles), ...(includeEdgeSegments ? { edgeSegments: edgeSegments(triangles, dieType, logicalResult) } : {}) }];
    }));
  } catch (error) {
    console.error(`Failed to extract ${dieType} DiceBox face UV regions:`, error); throw error;
  }
}
