import { encodeRuntimeThemePayload, validateRuntimeThemePayload } from './runtime-theme-codec.mjs';
import { buildRuntimeThemeIdentity } from './runtime-theme-identity.mjs';

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

export function buildRuntimeThemeConfig(payload) {
  const valid = assertPayload(payload);
  const token = encodeRuntimeThemePayload(valid);
  return {
    name: `Runtime ${valid.d.toUpperCase()} Appearance`,
    systemName: buildRuntimeThemeIdentity(valid.d, token),
    author: 'Nothing But A Dice Roller',
    version: 1,
    material: {
      type: 'color',
      diffuseTexture: { light: 'diffuse.svg', dark: 'diffuse.svg' },
      diffuseLevel: 1,
    },
    diceAvailable: [valid.d],
  };
}

export function buildRuntimeThemeSvg(payload) {
  const valid = assertPayload(payload);
  const text = valid.o.map(([value, color, fontId, x, y, fontPx]) => {
    const family = FONT_STACKS[fontId] || FONT_STACKS.default;
    return `<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${fontPx}" font-weight="700" text-anchor="middle" dominant-baseline="central">${escapeXml(value)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${valid.s}" height="${valid.s}" viewBox="0 0 ${valid.s} ${valid.s}">${text}</svg>`;
}
