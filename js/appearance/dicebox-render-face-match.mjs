const MIN_RENDER_FACE_AREA_RATIO = 0.2;

function triangleIndices(mesh, faceId) {
  const offset = faceId * 3;
  const indices = mesh?.indices?.slice(offset, offset + 3) || [];
  if (indices.length !== 3) throw new Error(`Mesh face ${faceId} has no triangle.`);
  return indices;
}

function trianglePosition(mesh, faceId) {
  if (!Array.isArray(mesh?.positions)) return null;
  return triangleIndices(mesh, faceId).map((vertexIndex) => {
    const point = [
      Number(mesh.positions[vertexIndex * 3]),
      Number(mesh.positions[(vertexIndex * 3) + 1]),
      Number(mesh.positions[(vertexIndex * 3) + 2]),
    ];
    if (!point.every(Number.isFinite)) throw new Error(`Mesh face ${faceId} has invalid position data.`);
    return point;
  });
}

function centroid(points) {
  return points.reduce((center, point) => (
    [center[0] + point[0] / 3, center[1] + point[1] / 3, center[2] + point[2] / 3]
  ), [0, 0, 0]);
}

function triangleArea(points) {
  const [a, b, c] = points;
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [
    (ab[1] * ac[2]) - (ab[2] * ac[1]),
    (ab[2] * ac[0]) - (ab[0] * ac[2]),
    (ab[0] * ac[1]) - (ab[1] * ac[0]),
  ];
  return Math.hypot(...cross) / 2;
}

function distanceSquared(a, b) {
  return ((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2);
}

export function matchColliderFaceToRenderFace(renderMesh, colliderMesh, colliderFaceId, usedRenderFaces = new Set()) {
  const colliderTriangle = trianglePosition(colliderMesh, colliderFaceId);
  if (!colliderTriangle || !Array.isArray(renderMesh?.positions)) return colliderFaceId;

  const colliderArea = triangleArea(colliderTriangle);
  if (!(colliderArea > Number.EPSILON)) throw new Error(`Collider face ${colliderFaceId} has zero area.`);
  const colliderCenter = centroid(colliderTriangle);
  const minimumArea = colliderArea * MIN_RENDER_FACE_AREA_RATIO;
  const renderFaceCount = Math.floor((renderMesh.indices?.length || 0) / 3);
  let bestFaceId = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let renderFaceId = 0; renderFaceId < renderFaceCount; renderFaceId += 1) {
    if (usedRenderFaces.has(renderFaceId)) continue;
    const renderTriangle = trianglePosition(renderMesh, renderFaceId);
    if (!renderTriangle || triangleArea(renderTriangle) < minimumArea) continue;
    const distance = distanceSquared(colliderCenter, centroid(renderTriangle));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestFaceId = renderFaceId;
    }
  }

  if (!Number.isInteger(bestFaceId)) {
    throw new Error(`Unable to match collider face ${colliderFaceId} to a full-size render face.`);
  }
  usedRenderFaces.add(bestFaceId);
  return bestFaceId;
}
