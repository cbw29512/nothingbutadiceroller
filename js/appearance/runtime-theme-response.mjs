import { faceFontStack } from './face-fonts.mjs';
import { encodeRuntimeThemePayload, validateRuntimeThemePayload } from './runtime-theme-codec.mjs';
import { buildRuntimeThemeIdentity } from './runtime-theme-identity.mjs';
import { runtimeInlayArtwork, runtimeInlaySettings } from './runtime-inlay-artwork.mjs';
import { runtimePatternArtwork, runtimePatternDefs, runtimePatternSettings } from './runtime-pattern-artwork.mjs';
import { runtimeResinArtwork, runtimeResinDefs, runtimeResinSettings } from './runtime-resin-artwork.mjs';
import { runtimeSurfaceArtwork, runtimeSurfaceDefs, runtimeSurfaceSettings } from './runtime-surface-artwork.mjs';

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

function glowFilter(glow) {
  if (!glow.enabled || glow.intensity <= 0) return '';
  const spread = (1.5 + (5.5 * glow.intensity)).toFixed(2);
  const blur = (5 + (18 * glow.intensity)).toFixed(2);
  const opacity = (0.65 + (0.35 * glow.intensity)).toFixed(2);
  return `<filter id="numberGlow" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="${spread}" result="expanded"/><feGaussianBlur in="expanded" stdDeviation="${blur}" result="blur"/><feFlood flood-color="${escapeXml(glow.color)}" flood-opacity="${opacity}" result="glowColor"/><feComposite in="glowColor" in2="blur" operator="in" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

function faceText(entry, glow) {
  const [value, color, fontId, x, y, fontPx] = entry;
  const common = `x="${x}" y="${y}" font-family="${escapeXml(faceFontStack(fontId))}" font-size="${fontPx}" font-weight="700" text-anchor="middle" dominant-baseline="central"`;
  const escaped = escapeXml(value);
  const halo = glow.enabled && glow.intensity > 0
    ? `<text ${common} fill="${escapeXml(glow.color)}" stroke="${escapeXml(glow.color)}" stroke-width="${(1.5 + (4.5 * glow.intensity)).toFixed(2)}" stroke-linejoin="round" paint-order="stroke fill" filter="url(#numberGlow)" data-number-glow="halo">${escaped}</text>`
    : '';
  return `${halo}<text ${common} fill="${escapeXml(color)}" data-number-glow="face">${escaped}</text>`;
}

export function buildRuntimeThemeConfig(payload) {
  const valid = assertPayload(payload);
  const token = encodeRuntimeThemePayload(valid);
  const resin = runtimeResinSettings(valid);
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
  const resin = runtimeResinSettings(valid);
  const surface = runtimeSurfaceSettings(valid);
  const pattern = runtimePatternSettings(valid);
  const inlay = runtimeInlaySettings(valid);
  const defs = glowFilter(glow) + runtimeResinDefs(resin) + runtimePatternDefs(pattern) + runtimeSurfaceDefs(surface);
  const text = valid.o.map((entry) => faceText(entry, glow)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${valid.s}" height="${valid.s}" viewBox="0 0 ${valid.s} ${valid.s}">${defs ? `<defs>${defs}</defs>` : ''}${runtimeResinArtwork(resin, valid)}${runtimePatternArtwork(pattern, valid)}${runtimeSurfaceArtwork(surface)}${runtimeInlayArtwork(inlay, valid)}${text}</svg>`;
}
