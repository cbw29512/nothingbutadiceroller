function xyz(array, vertexIndex) {
  return [array[vertexIndex * 3], array[(vertexIndex * 3) + 1], array[(vertexIndex * 3) + 2]].map(Number);
}

function uv(array, vertexIndex) {
  return [array[vertexIndex * 2], array[(vertexIndex * 2) + 1]].map(Number);
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function triangleVertices(mesh, faceId) {
  const indices = mesh.indices.slice(faceId * 3, (faceId * 3) + 3);
  if (indices.length !== 3) throw new Error(`d4 face ${faceId} has no triangle.`);
  return indices.map((index) => ({ index, position: xyz(mesh.positions, index), uv: uv(mesh.uvs || [], index) }));
}

function uniqueVertices(mesh, tolerance = 0.01) {
  const unique = [];
  for (let faceId = 0; faceId < 4; faceId += 1) {
    for (const vertex of triangleVertices(mesh, faceId)) {
      if (!unique.some((known) => distance(known, vertex.position) <= tolerance)) unique.push(vertex.position);
    }
  }
  if (unique.length !== 4) throw new Error(`Canonical d4 collider must resolve to four tetrahedron vertices; found ${unique.length}.`);
  return unique;
}

function findOppositeVertex(collider, bottomFaceId) {
  const all = uniqueVertices(collider);
  const bottom = triangleVertices(collider, bottomFaceId).map((vertex) => vertex.position);
  const opposite = all.find((candidate) => !bottom.some((point) => distance(candidate, point) <= 0.01));
  if (!opposite) throw new Error(`Unable to find d4 opposite vertex for face ${bottomFaceId}.`);
  return opposite;
}

function insetUv(vertices, target, ratio = 0.28) {
  const centerU = vertices.reduce((sum, vertex) => sum + vertex.uv[0], 0) / vertices.length;
  const centerV = vertices.reduce((sum, vertex) => sum + vertex.uv[1], 0) / vertices.length;
  return {
    u: target.uv[0] + ((centerU - target.uv[0]) * ratio),
    v: target.uv[1] + ((centerV - target.uv[1]) * ratio),
  };
}

export function extractD4VertexAnchors(modelData) {
  try {
    const render = modelData?.meshes?.find((mesh) => mesh?.name === 'd4');
    const collider = modelData?.meshes?.find((mesh) => mesh?.name === 'd4_collider');
    const map = modelData?.colliderFaceMap?.d4;
    if (!render || !collider || !map || !Array.isArray(render.uvs)) throw new Error('Canonical d4 geometry is incomplete.');
    const anchors = {};
    for (const [rawFaceId, rawResult] of Object.entries(map)) {
      const bottomFaceId = Number(rawFaceId); const logicalResult = Number(rawResult);
      const opposite = findOppositeVertex(collider, bottomFaceId);
      const marks = [];
      for (let faceId = 0; faceId < 4; faceId += 1) {
        if (faceId === bottomFaceId) continue;
        const vertices = triangleVertices(render, faceId);
        const nearest = vertices.reduce((best, vertex) => (
          distance(vertex.position, opposite) < distance(best.position, opposite) ? vertex : best
        ));
        marks.push({ faceId, ...insetUv(vertices, nearest) });
      }
      if (marks.length !== 3) throw new Error(`d4 result ${logicalResult} must have three visible vertex marks.`);
      anchors[String(logicalResult)] = { logicalResult, marks };
    }
    return anchors;
  } catch (error) {
    console.error('Failed to extract d4 vertex marking anchors:', error);
    throw error;
  }
}
