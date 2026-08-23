import { faceFontIdFromWireCode, faceFontWireCode } from './face-fonts.mjs';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const WIRE_MARKER = 'v6c';
const COORD_SCALE = 4095;

function encodeFixed(value, width) {
  let number = Math.round(Number(value));
  const limit = 64 ** width;
  if (!Number.isInteger(number) || number < 0 || number >= limit) throw new Error('Compact runtime value is out of range.');
  let output = '';
  for (let index = width - 1; index >= 0; index -= 1) {
    const divisor = 64 ** index;
    output += ALPHABET[Math.floor(number / divisor) % 64];
  }
  return output;
}
function decodeFixed(text) {
  let value = 0;
  for (const char of String(text)) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) throw new Error('Compact runtime value contains an invalid character.');
    value = (value * 64) + digit;
  }
  return value;
}
function compactColor(color) {
  const value = String(color || '');
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Compact runtime color is invalid.');
  return value.slice(1);
}
function expandColor(color) {
  const value = String(color || '');
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error('Compact runtime color is invalid.');
  return `#${value}`;
}
function packOperations(operations) {
  return operations.map(([text, color, fontId, x, y, fontPx]) => {
    const fontCode = faceFontWireCode(String(fontId || ''));
    const metrics = encodeFixed(Number(x) * 100, 3) + encodeFixed(Number(y) * 100, 3) + encodeFixed(Number(fontPx) * 100, 3);
    return [text, compactColor(color), fontCode, metrics];
  });
}
function unpackOperations(operations) {
  if (!Array.isArray(operations)) throw new Error('Compact runtime operations are invalid.');
  return operations.map((operation) => {
    if (!Array.isArray(operation) || operation.length !== 4 || String(operation[3]).length !== 9) throw new Error('Compact runtime operation is invalid.');
    const [text, color, fontCode, metrics] = operation;
    return [text, expandColor(color), faceFontIdFromWireCode(fontCode), decodeFixed(metrics.slice(0, 3)) / 100, decodeFixed(metrics.slice(3, 6)) / 100, decodeFixed(metrics.slice(6, 9)) / 100];
  });
}
function packBoundaries(boundaries, size) {
  if (!Array.isArray(boundaries)) throw new Error('Compact runtime boundaries are invalid.');
  let output = '';
  for (const face of boundaries) {
    if (!Array.isArray(face) || face.length < 12 || face.length % 4 !== 0) throw new Error('Compact runtime face boundaries are invalid.');
    const edgeCount = face.length / 4;
    output += encodeFixed(edgeCount, 1);
    for (const coordinate of face) {
      const normalized = Math.round((Number(coordinate) / Number(size)) * COORD_SCALE);
      output += encodeFixed(normalized, 2);
    }
  }
  return output;
}
function unpackBoundaries(text, size, faceCount) {
  const source = String(text || ''); let offset = 0; const boundaries = [];
  for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
    if (offset >= source.length) throw new Error('Compact runtime boundaries ended early.');
    const edgeCount = decodeFixed(source.slice(offset, offset + 1)); offset += 1;
    if (edgeCount < 3 || edgeCount > 12) throw new Error('Compact runtime edge count is invalid.');
    const face = [];
    for (let coordinateIndex = 0; coordinateIndex < edgeCount * 4; coordinateIndex += 1) {
      if (offset + 2 > source.length) throw new Error('Compact runtime coordinate data ended early.');
      const normalized = decodeFixed(source.slice(offset, offset + 2)); offset += 2;
      face.push(Math.round(((normalized / COORD_SCALE) * Number(size)) * 100) / 100);
    }
    boundaries.push(face);
  }
  if (offset !== source.length) throw new Error('Compact runtime boundaries contain trailing data.');
  return boundaries;
}
function packInlay(inlay, size) {
  const packed = [inlay[0], compactColor(inlay[1]), inlay[2], inlay[3]];
  if (inlay.length === 5) packed.push(packBoundaries(inlay[4], size));
  return packed;
}
function unpackInlay(inlay, size, faceCount) {
  if (!Array.isArray(inlay) || (inlay.length !== 4 && inlay.length !== 5)) throw new Error('Compact runtime inlay is invalid.');
  const unpacked = [inlay[0], expandColor(inlay[1]), inlay[2], inlay[3]];
  if (inlay.length === 5) unpacked.push(unpackBoundaries(inlay[4], size, faceCount));
  return unpacked;
}

export function isPackedRuntimeThemeV6(value) { return Array.isArray(value) && value[0] === WIRE_MARKER; }
export function packRuntimeThemeV6(payload) {
  return [WIRE_MARKER, payload.d, payload.s, packOperations(payload.o), payload.g, payload.r ?? null, payload.f, payload.p, packInlay(payload.i, payload.s)];
}
export function unpackRuntimeThemeV6(wire, faceCount) {
  if (!isPackedRuntimeThemeV6(wire) || wire.length !== 9) throw new Error('Compact runtime theme wire payload is invalid.');
  const [, d, s, operations, glow, resin, finish, pattern, inlay] = wire;
  const payload = { v: 6, d, s, o: unpackOperations(operations), g: glow, f: finish, p: pattern, i: unpackInlay(inlay, s, faceCount) };
  if (resin != null) payload.r = resin;
  return payload;
}
