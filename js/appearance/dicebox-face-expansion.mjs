export const CANONICAL_FACE_EDGE_COUNTS = Object.freeze({ d4: 3, d6: 4, d8: 3, d10: 4, d12: 5, d20: 3, d100: 4 });

const POSITION_DIGITS = 5;
const PLANE_TOLERANCE = 0.0002;
const NORMAL_DOT_MINIMUM = 0.995;

function positionKey(point) { return point.map((value) => Number(value).toFixed(POSITION_DIGITS)).join(':'); }
function triangleIndices(mesh, faceId) {
  const indices = mesh?.indices?.slice(faceId * 3, (faceId * 3) + 3) || [];
  if (indices.length !== 3) throw new Error(`Render face ${faceId} has no triangle.`);
  return indices;
}
function trianglePositions(mesh, faceId) {
  if (!Array.isArray(mesh?.positions)) throw new Error('Render mesh is missing position data.');
  return triangleIndices(mesh, faceId).map((vertexIndex) => {
    const point = [Number(mesh.positions[vertexIndex * 3]), Number(mesh.positions[(vertexIndex * 3) + 1]), Number(mesh.positions[(vertexIndex * 3) + 2])];
    if (!point.every(Number.isFinite)) throw new Error(`Render face ${faceId} contains invalid position data.`);
    return point;
  });
}
function cross(a, b) { return [(a[1] * b[2]) - (a[2] * b[1]), (a[2] * b[0]) - (a[0] * b[2]), (a[0] * b[1]) - (a[1] * b[0])]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]); }
function unitNormal(points) {
  const raw = cross(subtract(points[1], points[0]), subtract(points[2], points[0]));
  const length = Math.hypot(...raw);
  if (!(length > Number.EPSILON)) throw new Error('Render face has zero area.');
  return raw.map((value) => value / length);
}
function edgeKeys(points) {
  return [[0, 1], [1, 2], [2, 0]].map(([a, b]) => [positionKey(points[a]), positionKey(points[b])].sort().join('|'));
}
function makeFace(mesh, faceId) {
  const points = trianglePositions(mesh, faceId);
  return { faceId, points, normal: unitNormal(points), edges: edgeKeys(points) };
}
function samePlane(face, seed) {
  if (dot(face.normal, seed.normal) < NORMAL_DOT_MINIMUM) return false;
  const plane = dot(seed.normal, seed.points[0]);
  return face.points.every((point) => Math.abs(dot(seed.normal, point) - plane) <= PLANE_TOLERANCE);
}
function boundaryEdgeCount(faces) {
  const counts = new Map();
  for (const face of faces) for (const edge of face.edges) counts.set(edge, (counts.get(edge) || 0) + 1);
  if ([...counts.values()].some((count) => count > 2)) throw new Error('Expanded render face contains a non-manifold edge.');
  return [...counts.values()].filter((count) => count === 1).length;
}

export function expandCoplanarRenderFace(renderMesh, seedFaceIds, dieType, logicalResult) {
  try {
    const expectedEdges = CANONICAL_FACE_EDGE_COUNTS[dieType];
    if (!Number.isInteger(expectedEdges)) throw new Error(`No canonical face-edge count exists for ${dieType}.`);
    const seeds = [...new Set(seedFaceIds)].map(Number);
    if (!seeds.length || seeds.some((faceId) => !Number.isInteger(faceId))) throw new Error(`${dieType} face ${logicalResult} has invalid render-face seeds.`);
    const renderFaceCount = Math.floor((renderMesh?.indices?.length || 0) / 3);
    const allFaces = Array.from({ length: renderFaceCount }, (_, faceId) => makeFace(renderMesh, faceId));
    const seed = allFaces[seeds[0]];
    if (!seed) throw new Error(`${dieType} face ${logicalResult} seed is outside the render mesh.`);
    const candidates = allFaces.filter((face) => samePlane(face, seed));
    const included = new Map(seeds.map((faceId) => [faceId, allFaces[faceId]]));
    if ([...included.values()].some((face) => !face || !samePlane(face, seed))) throw new Error(`${dieType} face ${logicalResult} seeds are not coplanar.`);
    const openEdges = new Set([...included.values()].flatMap((face) => face.edges));
    let changed = true;
    while (changed) {
      changed = false;
      for (const face of candidates) {
        if (included.has(face.faceId) || !face.edges.some((edge) => openEdges.has(edge))) continue;
        included.set(face.faceId, face); face.edges.forEach((edge) => openEdges.add(edge)); changed = true;
      }
    }
    const faces = [...included.values()];
    const boundaryCount = boundaryEdgeCount(faces);
    if (boundaryCount !== expectedEdges) {
      throw new Error(`${dieType} face ${logicalResult} expansion must produce ${expectedEdges} outer edges; found ${boundaryCount} across ${faces.length} render triangles.`);
    }
    return faces.map((face) => face.faceId).sort((a, b) => a - b);
  } catch (error) {
    console.error('Failed to expand canonical render face:', error); throw error;
  }
}
