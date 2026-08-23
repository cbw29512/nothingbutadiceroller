import { CANONICAL_DICE } from './defaults.mjs';
import { isValidFaceDisplayValue } from './face-display.mjs';
import { getCanonicalFaceResults } from './face-values.mjs';
import { EDGE_INLAY_TYPES } from './inlay-style.mjs';
import { SURFACE_PATTERN_TYPES } from './pattern-style.mjs';
import { INTERIOR_EFFECT_TYPES } from './resin-style.mjs';
import { SURFACE_FINISH_TYPES } from './surface-style.mjs';

export const RUNTIME_THEME_VERSION = 6;
const LEGACY_RUNTIME_THEME_VERSIONS = new Set([1, 2, 3, 4, 5]);
const HEX = /^#[0-9a-f]{6}$/i;
const FONT_IDS = new Set(['', 'default', 'fantasy', 'runic', 'mono']);
const INTERIOR_TYPES = new Set(INTERIOR_EFFECT_TYPES);
const FINISH_TYPES = new Set(SURFACE_FINISH_TYPES);
const PATTERN_TYPES = new Set(SURFACE_PATTERN_TYPES);
const INLAY_TYPES = new Set(EDGE_INLAY_TYPES);
const MAX_OPERATIONS = 24;
const MAX_BOUNDARY_POINTS = 24;

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text); let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function base64UrlDecode(token) {
  const normalized = String(token).replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
function validateGlow(glow, errors) {
  if (!Array.isArray(glow) || glow.length !== 3) {
    errors.push('Runtime glow settings are invalid.');
    return;
  }
  const [enabled, color, intensity] = glow;
  if (typeof enabled !== 'boolean') errors.push('Runtime glow enabled flag is invalid.');
  if (!HEX.test(String(color || ''))) errors.push('Runtime glow color is invalid.');
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) errors.push('Runtime glow intensity is invalid.');
}
function validateResin(resin, errors) {
  if (!Array.isArray(resin) || resin.length !== 10) {
    errors.push('Runtime resin settings are invalid.');
    return;
  }
  const [clearEnabled, opacity, frost, tintColor, interiorEnabled, type, primary, secondary, density, intensity] = resin;
  if (typeof clearEnabled !== 'boolean') errors.push('Runtime clear-resin flag is invalid.');
  if (!Number.isFinite(opacity) || opacity < 0.25 || opacity > 1) errors.push('Runtime resin opacity is invalid.');
  if (!Number.isFinite(frost) || frost < 0 || frost > 1) errors.push('Runtime resin frost is invalid.');
  if (!HEX.test(String(tintColor || ''))) errors.push('Runtime resin tint color is invalid.');
  if (typeof interiorEnabled !== 'boolean') errors.push('Runtime interior enabled flag is invalid.');
  if (!INTERIOR_TYPES.has(String(type || ''))) errors.push('Runtime interior effect is invalid.');
  if (interiorEnabled && type === 'none') errors.push('Runtime interior effect cannot be none while enabled.');
  if (!HEX.test(String(primary || '')) || !HEX.test(String(secondary || ''))) errors.push('Runtime interior colors are invalid.');
  if (!Number.isFinite(density) || density < 0 || density > 1) errors.push('Runtime interior density is invalid.');
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) errors.push('Runtime interior intensity is invalid.');
}
function validateFinish(finish, errors) {
  if (!Array.isArray(finish) || finish.length !== 3) {
    errors.push('Runtime surface finish settings are invalid.');
    return;
  }
  const [type, accentColor, intensity] = finish;
  if (!FINISH_TYPES.has(String(type || ''))) errors.push('Runtime surface finish is invalid.');
  if (!HEX.test(String(accentColor || ''))) errors.push('Runtime surface finish accent color is invalid.');
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) errors.push('Runtime surface finish intensity is invalid.');
}
function validatePattern(pattern, errors) {
  if (!Array.isArray(pattern) || pattern.length !== 5) {
    errors.push('Runtime surface pattern settings are invalid.');
    return;
  }
  const [type, primaryColor, secondaryColor, intensity, scale] = pattern;
  if (!PATTERN_TYPES.has(String(type || ''))) errors.push('Runtime surface pattern is invalid.');
  if (!HEX.test(String(primaryColor || ''))) errors.push('Runtime surface pattern primary color is invalid.');
  if (!HEX.test(String(secondaryColor || ''))) errors.push('Runtime surface pattern secondary color is invalid.');
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) errors.push('Runtime surface pattern intensity is invalid.');
  if (!Number.isFinite(scale) || scale < 0 || scale > 1) errors.push('Runtime surface pattern scale is invalid.');
}
function validateBoundaries(boundaries, payload, errors) {
  if (!Array.isArray(boundaries) || boundaries.length !== getCanonicalFaceResults(payload.d).length) {
    errors.push('Runtime edge-inlay boundaries do not cover every physical face.');
    return;
  }
  for (const [index, loop] of boundaries.entries()) {
    if (!Array.isArray(loop) || loop.length < 6 || loop.length > MAX_BOUNDARY_POINTS * 2 || loop.length % 2 !== 0) {
      errors.push(`Runtime edge-inlay boundary ${index} is invalid.`); continue;
    }
    if (!loop.every((value) => Number.isFinite(value) && value >= 0 && value <= payload.s)) {
      errors.push(`Runtime edge-inlay boundary ${index} contains invalid coordinates.`);
    }
  }
}
function validateInlay(inlay, payload, errors) {
  if (!Array.isArray(inlay) || (inlay.length !== 4 && inlay.length !== 5)) {
    errors.push('Runtime edge-inlay settings are invalid.');
    return;
  }
  const [type, color, intensity, width, boundaries] = inlay;
  if (!INLAY_TYPES.has(String(type || ''))) errors.push('Runtime edge-inlay type is invalid.');
  if (!HEX.test(String(color || ''))) errors.push('Runtime edge-inlay color is invalid.');
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) errors.push('Runtime edge-inlay intensity is invalid.');
  if (!Number.isFinite(width) || width < 0 || width > 1) errors.push('Runtime edge-inlay width is invalid.');
  if (type === 'none') {
    if (inlay.length !== 4) errors.push('Disabled runtime edge inlay must not carry face geometry.');
  } else if (inlay.length !== 5) errors.push('Enabled runtime edge inlay requires face boundaries.');
  else validateBoundaries(boundaries, payload, errors);
}
export function validateRuntimeThemePayload(payload) {
  const errors = [];
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, errors: ['Payload must be an object.'] };
    const supportedVersion = payload.v === RUNTIME_THEME_VERSION || LEGACY_RUNTIME_THEME_VERSIONS.has(payload.v);
    let allowedFields = ['v', 'd', 's', 'o'];
    if (payload.v === 2) allowedFields = [...allowedFields, 'g'];
    if (payload.v === 3) allowedFields = [...allowedFields, 'g', 'r'];
    if (payload.v === 4) allowedFields = [...allowedFields, 'g', 'r', 'f'];
    if (payload.v === 5) allowedFields = [...allowedFields, 'g', 'r', 'f', 'p'];
    if (payload.v === RUNTIME_THEME_VERSION) allowedFields = [...allowedFields, 'g', 'r', 'f', 'p', 'i'];
    const extra = Object.keys(payload).filter((key) => !allowedFields.includes(key));
    if (extra.length) errors.push(`Unsupported payload fields: ${extra.join(', ')}.`);
    if (!supportedVersion) errors.push('Unsupported runtime theme version.');
    if (!Object.hasOwn(CANONICAL_DICE, payload.d)) errors.push('Unsupported runtime theme die type.');
    if (!Number.isInteger(payload.s) || payload.s < 256 || payload.s > 2048) errors.push('Runtime atlas size is invalid.');
    if (!Array.isArray(payload.o) || payload.o.length < 1 || payload.o.length > MAX_OPERATIONS) errors.push('Runtime draw operations are invalid.');
    for (const [index, operation] of (Array.isArray(payload.o) ? payload.o : []).entries()) {
      if (!Array.isArray(operation) || operation.length !== 6) { errors.push(`Operation ${index} has an invalid shape.`); continue; }
      const [text, color, fontId, x, y, fontPx] = operation;
      if (!isValidFaceDisplayValue(text)) errors.push(`Operation ${index} text must be a short visible label.`);
      if (!HEX.test(String(color || ''))) errors.push(`Operation ${index} color is invalid.`);
      if (!FONT_IDS.has(String(fontId || ''))) errors.push(`Operation ${index} font is invalid.`);
      if (![x, y].every((value) => Number.isFinite(value) && value >= 0 && value <= payload.s)) errors.push(`Operation ${index} position is invalid.`);
      if (!Number.isFinite(fontPx) || fontPx < 6 || fontPx > 200) errors.push(`Operation ${index} font size is invalid.`);
    }
    if ([2, 3, 4, 5, RUNTIME_THEME_VERSION].includes(payload.v)) validateGlow(payload.g, errors);
    if ([3, 4, 5, RUNTIME_THEME_VERSION].includes(payload.v) && payload.r != null) validateResin(payload.r, errors);
    if ([4, 5, RUNTIME_THEME_VERSION].includes(payload.v)) validateFinish(payload.f, errors);
    if ([5, RUNTIME_THEME_VERSION].includes(payload.v)) validatePattern(payload.p, errors);
    if (payload.v === RUNTIME_THEME_VERSION) validateInlay(payload.i, payload, errors);
  } catch (error) {
    console.error('Runtime theme payload validation failed:', error); errors.push('Runtime theme payload validation failed.');
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
    console.error('Failed to decode runtime theme token:', error); throw error;
  }
}
