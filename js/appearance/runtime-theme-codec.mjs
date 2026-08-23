import { CANONICAL_DICE } from './defaults.mjs';
import { isValidFaceDisplayValue } from './face-display.mjs';
import { INTERIOR_EFFECT_TYPES } from './resin-style.mjs';
import { SURFACE_FINISH_TYPES } from './surface-style.mjs';

export const RUNTIME_THEME_VERSION = 4;
const LEGACY_RUNTIME_THEME_VERSIONS = new Set([1, 2, 3]);
const HEX = /^#[0-9a-f]{6}$/i;
const FONT_IDS = new Set(['', 'default', 'fantasy', 'runic', 'mono']);
const INTERIOR_TYPES = new Set(INTERIOR_EFFECT_TYPES);
const FINISH_TYPES = new Set(SURFACE_FINISH_TYPES);
const MAX_OPERATIONS = 24;

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
export function validateRuntimeThemePayload(payload) {
  const errors = [];
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, errors: ['Payload must be an object.'] };
    const supportedVersion = payload.v === RUNTIME_THEME_VERSION || LEGACY_RUNTIME_THEME_VERSIONS.has(payload.v);
    let allowedFields = ['v', 'd', 's', 'o'];
    if (payload.v === 2) allowedFields = [...allowedFields, 'g'];
    if (payload.v === 3) allowedFields = [...allowedFields, 'g', 'r'];
    if (payload.v === RUNTIME_THEME_VERSION) allowedFields = [...allowedFields, 'g', 'r', 'f'];
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
    if (payload.v === 2 || payload.v === 3 || payload.v === RUNTIME_THEME_VERSION) validateGlow(payload.g, errors);
    if ((payload.v === 3 || payload.v === RUNTIME_THEME_VERSION) && payload.r != null) validateResin(payload.r, errors);
    if (payload.v === RUNTIME_THEME_VERSION) validateFinish(payload.f, errors);
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
