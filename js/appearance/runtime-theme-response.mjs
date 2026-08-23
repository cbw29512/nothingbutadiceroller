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
  const blur = (2 + (10 * glow.intensity)).toFixed(2);
  const opacity = (0.3 + (0.7 * glow.intensity)).toFixed(2);
  return `<filter id="numberGlow" x="-70%" y="-70%" width="240%" height="240%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="blur"/><feFlood flood-color="${escapeXml(glow.color)}" flood-opacity="${opacity}" result="glowColor"/><feComposite in="glowColor" in2="blur" operator="in" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
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
  const filterAttribute = glow.enabled && glow.intensity > 0 ? ' filter="url(#numberGlow)"' : '';
  const defs = glowFilter(glow) + runtimeResinDefs(resin) + runtimePatternDefs(pattern) + runtimeSurfaceDefs(surface);
  const text = valid.o.map(([value, color, fontId, x, y, fontPx]) => (
    `<text x="${x}" y="${y}" fill="${color}" font-family="${faceFontStack(fontId)}" font-size="${fontPx}" font-weight="700" text-anchor="middle" dominant-baseline="central"${filterAttribute}>${escapeXml(value)}</text>`
  )).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${valid.s}" height="${valid.s}" viewBox="0 0 ${valid.s} ${valid.s}">${defs ? `<defs>${defs}</defs>` : ''}${runtimeResinArtwork(resin, valid)}${runtimePatternArtwork(pattern, valid)}${runtimeSurfaceArtwork(surface)}${runtimeInlayArtwork(inlay, valid)}${text}</svg>`;
}
