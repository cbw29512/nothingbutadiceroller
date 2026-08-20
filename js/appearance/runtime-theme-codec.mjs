import { CANONICAL_DICE } from './defaults.mjs';

export const RUNTIME_THEME_VERSION = 1;
const HEX = /^#[0-9a-f]{6}$/i;
const FONT_IDS = new Set(['', 'default', 'fantasy', 'runic', 'mono']);
const MAX_OPERATIONS = 24;

function graphemeCount(value) {
  try {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(String(value))].length;
  } catch {
    return Array.from(String(value)).length;
  }
}

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(token) {
  const normalized = String(token).replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function validateRuntimeThemePayload(payload) {
  const errors = [];
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, errors: ['Payload must be an object.'] };
    const extra = Object.keys(payload).filter((key) => !['v', 'd', 's', 'o'].includes(key));
    if (extra.length) errors.push(`Unsupported payload fields: ${extra.join(', ')}.`);
    if (payload.v !== RUNTIME_THEME_VERSION) errors.push('Unsupported runtime theme version.');
    if (!Object.hasOwn(CANONICAL_DICE, payload.d)) errors.push('Unsupported runtime theme die type.');
    if (!Number.isInteger(payload.s) || payload.s < 256 || payload.s > 2048) errors.push('Runtime atlas size is invalid.');
    if (!Array.isArray(payload.o) || payload.o.length < 1 || payload.o.length > MAX_OPERATIONS) errors.push('Runtime draw operations are invalid.');
    for (const [index, operation] of (Array.isArray(payload.o) ? payload.o : []).entries()) {
      if (!Array.isArray(operation) || operation.length !== 6) { errors.push(`Operation ${index} has an invalid shape.`); continue; }
      const [text, color, fontId, x, y, fontPx] = operation;
      const length = graphemeCount(String(text || '').trim());
      if (length < 1 || length > 12) errors.push(`Operation ${index} text is invalid.`);
      if (!HEX.test(String(color || ''))) errors.push(`Operation ${index} color is invalid.`);
      if (!FONT_IDS.has(String(fontId || ''))) errors.push(`Operation ${index} font is invalid.`);
      if (![x, y].every((value) => Number.isFinite(value) && value >= 0 && value <= payload.s)) errors.push(`Operation ${index} position is invalid.`);
      if (!Number.isFinite(fontPx) || fontPx < 6 || fontPx > 200) errors.push(`Operation ${index} font size is invalid.`);
    }
  } catch (error) {
    console.error('Runtime theme payload validation failed:', error);
    errors.push('Runtime theme payload validation failed.');
  }
  return { ok: errors.length === 0, errors };
}

export function encodeRuntimeThemePayload(payload) {
  const validation = validateRuntimeThemePayload(payload);
  if (!validation.ok) throw new Error(validation.errors.join(' | '));
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeRuntimeThemePayload(token) {
  try {
    if (!token || String(token).length > 6000) throw new Error('Runtime theme token is invalid.');
    const payload = JSON.parse(base64UrlDecode(token));
    const validation = validateRuntimeThemePayload(payload);
    if (!validation.ok) throw new Error(validation.errors.join(' | '));
    return payload;
  } catch (error) {
    console.error('Failed to decode runtime theme token:', error);
    throw error;
  }
}
