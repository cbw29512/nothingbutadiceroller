export const CANONICAL_FACE_EDGE_COUNTS = Object.freeze({ d4: 3, d6: 4, d8: 3, d10: 4, d12: 5, d20: 3, d100: 4 });

const POSITION_DIGITS = 5;
const PLANE_TOLERANCE = 0.0002;
const NORMAL_DOT_MINIMUM = 0.995;
const MAX_PATCH_TRIANGLES = 8;
const MAX_SEARCH_STATES = 500;

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
function edgeCounts(faces) {
  const counts = new Map();
  for (const face of faces) for (const edge of face.edges) counts.set(edge, (counts.get(edge) || 0) + 1);
  if ([...counts.values()].some((count) => count > 2)) return null;
  return counts;
}
function boundaryEdges(faces) {
  const counts = edgeCounts(faces);
  if (!counts) return null;
  return new Set([...counts].filter(([, count]) => count === 1).map(([edge]) => edge));
}
function stateKey(faceIds) { return [...faceIds].sort((a, b) => a - b).join(','); }
function searchFromSeed(allFaces, seedFaceId, expectedEdges, dieType, logicalResult) {
  const seed = allFaces[seedFaceId];
  if (!seed) return null;
  const candidates = allFaces.filter((face) => samePlane(face, seed));
  const candidateById = new Map(candidates.map((face) => [face.faceId, face]));
  const queue = [[seedFaceId]]; const visited = new Set(); let examined = 0;
  while (queue.length && examined < MAX_SEARCH_STATES) {
    const ids = queue.shift(); const key = stateKey(ids);
    if (visited.has(key)) continue; visited.add(key); examined += 1;
    const faces = ids.map((faceId) => candidateById.get(faceId)).filter(Boolean);
    if (faces.length !== ids.length) continue;
    const boundary = boundaryEdges(faces);
    if (!boundary) continue;
    if (boundary.size === expectedEdges) return [...ids].sort((a, b) => a - b);
    if (ids.length >= MAX_PATCH_TRIANGLES) continue;
    for (const candidate of candidates) {
      if (ids.includes(candidate.faceId) || !candidate.edges.some((edge) => boundary.has(edge))) continue;
      queue.push([...ids, candidate.faceId]);
    }
  }
  console.warn(`No exact ${expectedEdges}-edge coplanar patch found from ${dieType} face ${logicalResult} seed ${seedFaceId}; examined ${examined} states.`);
  return null;
}

export function expandCoplanarRenderFace(renderMesh, seedFaceIds, dieType, logicalResult) {
  try {
    const expectedEdges = CANONICAL_FACE_EDGE_COUNTS[dieType];
    if (!Number.isInteger(expectedEdges)) throw new Error(`No canonical face-edge count exists for ${dieType}.`);
    const seeds = [...new Set(seedFaceIds)].map(Number).filter(Number.isInteger);
    if (!seeds.length) throw new Error(`${dieType} face ${logicalResult} has invalid render-face seeds.`);
    const renderFaceCount = Math.floor((renderMesh?.indices?.length || 0) / 3);
    const allFaces = Array.from({ length: renderFaceCount }, (_, faceId) => makeFace(renderMesh, faceId));
    for (const seedFaceId of seeds) {
      const match = searchFromSeed(allFaces, seedFaceId, expectedEdges, dieType, logicalResult);
      if (match) return match;
    }
    throw new Error(`${dieType} face ${logicalResult} could not reconstruct an exact ${expectedEdges}-edge canonical render face from ${seeds.length} matched seed(s).`);
  } catch (error) {
    console.error('Failed to expand canonical render face:', error); throw error;
  }
}
