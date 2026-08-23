import { RUNTIME_THEME_VERSION } from './runtime-theme-codec.mjs';
import { encodeRuntimeThemePayload, validateRuntimeThemePayload } from './runtime-theme-codec.mjs';
import { buildRuntimeThemeIdentity } from './runtime-theme-identity.mjs';
import { runtimeSurfaceArtwork, runtimeSurfaceDefs, runtimeSurfaceSettings } from './runtime-surface-artwork.mjs';

const FONT_STACKS = Object.freeze({
  '': 'Arial, sans-serif',
  default: 'Arial, sans-serif',
  fantasy: 'Georgia, serif',
  runic: 'Georgia, serif',
  mono: 'Courier New, monospace',
});

function assertPayload(payload) {
  const validation = validateRuntimeThemePayload(payload);
  if (!validation.ok) throw new Error(validation.errors.join(' | '));
  return payload;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
function glowSettings(payload) {
  if (payload.v < 2 || !Array.isArray(payload.g)) return { enabled: false, color: '#ffffff', intensity: 0 };
  return { enabled: payload.g[0] === true, color: payload.g[1], intensity: Number(payload.g[2]) };
}
function resinSettings(payload) {
  if (payload.v < 3 || !Array.isArray(payload.r)) {
    return {
      clearEnabled: false, opacity: 1, frost: 0, tintColor: '#ffffff',
      interiorEnabled: false, type: 'none', primary: '#ffffff', secondary: '#ffffff', density: 0, intensity: 0,
    };
  }
  return {
    clearEnabled: payload.r[0] === true,
    opacity: Number(payload.r[1]),
    frost: Number(payload.r[2]),
    tintColor: payload.r[3],
    interiorEnabled: payload.r[4] === true,
    type: payload.r[5],
    primary: payload.r[6],
    secondary: payload.r[7],
    density: Number(payload.r[8]),
    intensity: Number(payload.r[9]),
  };
}
function glowFilter(glow) {
  if (!glow.enabled || glow.intensity <= 0) return '';
  const blur = (2 + (10 * glow.intensity)).toFixed(2);
  const opacity = (0.3 + (0.7 * glow.intensity)).toFixed(2);
  return `<filter id="numberGlow" x="-70%" y="-70%" width="240%" height="240%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="blur"/><feFlood flood-color="${escapeXml(glow.color)}" flood-opacity="${opacity}" result="glowColor"/><feComposite in="glowColor" in2="blur" operator="in" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}
function resinDefs(resin) {
  const defs = [];
  if (resin.clearEnabled) {
    defs.push(`<linearGradient id="resinSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="0.38" stop-color="${escapeXml(resin.tintColor)}" stop-opacity="${(0.06 + resin.frost * 0.14).toFixed(2)}"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.03"/></linearGradient>`);
  }
  if (resin.interiorEnabled && (resin.type === 'smoke' || resin.type === 'nebula')) {
    defs.push(`<filter id="interiorBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>`);
  }
  return defs.join('');
}
function seedFrom(resin, payload) {
  const source = `${payload.d}|${resin.type}|${resin.primary}|${resin.secondary}|${resin.density}|${resin.intensity}`;
  let seed = 2166136261;
  for (const char of source) {
    seed ^= char.codePointAt(0);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  return seed || 1;
}
function randomFactory(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function colorFor(index, resin) {
  return index % 2 ? resin.secondary : resin.primary;
}
function glitterArtwork(resin, payload, random) {
  const count = Math.round(10 + (resin.density * 36));
  const opacity = (0.35 + resin.intensity * 0.55).toFixed(2);
  return Array.from({ length: count }, (_, index) => {
    const x = Math.round(random() * payload.s); const y = Math.round(random() * payload.s);
    const radius = (1.5 + random() * 5.5).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${escapeXml(colorFor(index, resin))}" fill-opacity="${opacity}"/>`;
  }).join('');
}
function flakeArtwork(resin, payload, random) {
  const count = Math.round(6 + (resin.density * 22));
  const opacity = (0.28 + resin.intensity * 0.52).toFixed(2);
  return Array.from({ length: count }, (_, index) => {
    const x = random() * payload.s; const y = random() * payload.s; const size = 8 + random() * 28;
    const points = `${x.toFixed(1)},${(y - size).toFixed(1)} ${(x + size * 0.7).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + size).toFixed(1)} ${(x - size * 0.7).toFixed(1)},${y.toFixed(1)}`;
    return `<polygon points="${points}" fill="${escapeXml(colorFor(index, resin))}" fill-opacity="${opacity}"/>`;
  }).join('');
}
function bubbleArtwork(resin, payload, random) {
  const count = Math.round(6 + (resin.density * 20));
  const opacity = (0.28 + resin.intensity * 0.45).toFixed(2);
  return Array.from({ length: count }, (_, index) => {
    const x = Math.round(random() * payload.s); const y = Math.round(random() * payload.s); const radius = 7 + random() * 24;
    const stroke = colorFor(index, resin);
    return `<circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="none" stroke="${escapeXml(stroke)}" stroke-opacity="${opacity}" stroke-width="${(1.5 + random() * 4).toFixed(1)}"/>`;
  }).join('');
}
function cloudArtwork(resin, payload, random, nebula = false) {
  const count = Math.round((nebula ? 5 : 4) + (resin.density * (nebula ? 10 : 7)));
  const opacity = (0.16 + resin.intensity * 0.3).toFixed(2);
  const clouds = Array.from({ length: count }, (_, index) => {
    const x = Math.round(random() * payload.s); const y = Math.round(random() * payload.s);
    const rx = 45 + random() * 130; const ry = 25 + random() * 100;
    return `<ellipse cx="${x}" cy="${y}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${escapeXml(colorFor(index, resin))}" fill-opacity="${opacity}" filter="url(#interiorBlur)"/>`;
  }).join('');
  if (!nebula) return clouds;
  const stars = Array.from({ length: Math.round(6 + resin.density * 20) }, () => {
    const x = Math.round(random() * payload.s); const y = Math.round(random() * payload.s); const radius = (0.8 + random() * 2.2).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#ffffff" fill-opacity="${(0.35 + random() * 0.55).toFixed(2)}"/>`;
  }).join('');
  return clouds + stars;
}
function interiorArtwork(resin, payload) {
  if (!resin.interiorEnabled || resin.type === 'none') return '';
  const random = randomFactory(seedFrom(resin, payload));
  if (resin.type === 'glitter') return glitterArtwork(resin, payload, random);
  if (resin.type === 'flakes') return flakeArtwork(resin, payload, random);
  if (resin.type === 'bubbles') return bubbleArtwork(resin, payload, random);
  if (resin.type === 'smoke') return cloudArtwork(resin, payload, random, false);
  if (resin.type === 'nebula') return cloudArtwork(resin, payload, random, true);
  return '';
}
function resinArtwork(resin, payload) {
  const parts = [];
  if (resin.clearEnabled) {
    const frostOpacity = Math.min(0.2, resin.frost * 0.18).toFixed(2);
    if (Number(frostOpacity) > 0) parts.push(`<rect width="100%" height="100%" fill="#ffffff" fill-opacity="${frostOpacity}"/>`);
    parts.push(`<rect width="100%" height="100%" fill="url(#resinSheen)" fill-opacity="${Math.max(0.28, 1 - resin.opacity * 0.45).toFixed(2)}"/>`);
  }
  parts.push(interiorArtwork(resin, payload));
  return parts.join('');
}

export function buildRuntimeThemeConfig(payload) {
  const valid = assertPayload(payload);
  const token = encodeRuntimeThemePayload(valid);
  const resin = resinSettings(valid);
  return {
    name: `Runtime ${valid.d.toUpperCase()} Appearance`,
    systemName: buildRuntimeThemeIdentity(valid.d, token),
    author: 'Nothing But A Dice Roller',
    version: 1,
    material: {
      type: 'color',
      diffuseTexture: { light: 'diffuse.svg', dark: 'diffuse.svg' },
      diffuseLevel: resin.clearEnabled ? 0.86 : 1,
    },
    diceAvailable: [valid.d],
  };
}

export function buildRuntimeThemeSvg(payload) {
  const valid = assertPayload(payload);
  const glow = glowSettings(valid);
  const resin = resinSettings(valid);
  const surface = runtimeSurfaceSettings(valid);
  const filterAttribute = glow.enabled && glow.intensity > 0 ? ' filter="url(#numberGlow)"' : '';
  const defs = glowFilter(glow) + resinDefs(resin) + runtimeSurfaceDefs(surface);
  const text = valid.o.map(([value, color, fontId, x, y, fontPx]) => {
    const family = FONT_STACKS[fontId] || FONT_STACKS.default;
    return `<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${fontPx}" font-weight="700" text-anchor="middle" dominant-baseline="central"${filterAttribute}>${escapeXml(value)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${valid.s}" height="${valid.s}" viewBox="0 0 ${valid.s} ${valid.s}">${defs ? `<defs>${defs}</defs>` : ''}${resinArtwork(resin, valid)}${runtimeSurfaceArtwork(surface)}${text}</svg>`;
}
