import { DEFAULT_SURFACE_PATTERN } from './pattern-style.mjs';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function seedFrom(pattern, payload) {
  const source = `${payload.d}|${pattern.type}|${pattern.primaryColor}|${pattern.secondaryColor}|${pattern.intensity}|${pattern.scale}`;
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

export function runtimePatternSettings(payload) {
  try {
    if (!payload || payload.v < 5 || !Array.isArray(payload.p)) {
      return { ...DEFAULT_SURFACE_PATTERN };
    }
    return {
      type: String(payload.p[0]),
      primaryColor: String(payload.p[1]),
      secondaryColor: String(payload.p[2]),
      intensity: Number(payload.p[3]),
      scale: Number(payload.p[4]),
    };
  } catch (error) {
    console.error('Failed to read runtime surface-pattern settings:', error);
    return { ...DEFAULT_SURFACE_PATTERN };
  }
}

export function runtimePatternDefs(pattern) {
  try {
    if (pattern.type !== 'split') return '';
    const primary = escapeXml(pattern.primaryColor);
    const secondary = escapeXml(pattern.secondaryColor);
    return `<linearGradient id="patternSplit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="0.495" stop-color="${primary}"/><stop offset="0.505" stop-color="${secondary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient>`;
  } catch (error) {
    console.error('Failed to build runtime surface-pattern defs:', error);
    return '';
  }
}

function splitArtwork(pattern) {
  const opacity = (0.12 + (pattern.intensity * 0.5)).toFixed(2);
  return `<g id="patternSplitTone"><rect width="100%" height="100%" fill="url(#patternSplit)" fill-opacity="${opacity}"/></g>`;
}

function speckleArtwork(pattern, payload, random) {
  const count = Math.round(18 + (pattern.scale * 72));
  const opacity = (0.12 + (pattern.intensity * 0.42)).toFixed(2);
  return `<g id="patternSpeckle">${Array.from({ length: count }, (_, index) => {
    const x = Math.round(random() * payload.s);
    const y = Math.round(random() * payload.s);
    const radius = (1.2 + random() * (2 + pattern.scale * 6)).toFixed(1);
    const color = index % 2 ? pattern.secondaryColor : pattern.primaryColor;
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${escapeXml(color)}" fill-opacity="${opacity}"/>`;
  }).join('')}</g>`;
}

function marbleArtwork(pattern, payload, random) {
  const count = Math.round(4 + (pattern.scale * 8));
  const opacity = 0.1 + (pattern.intensity * 0.34);
  const size = payload.s;
  return `<g id="patternMarble">${Array.from({ length: count }, (_, index) => {
    const y0 = random() * size;
    const y1 = random() * size;
    const y2 = random() * size;
    const y3 = random() * size;
    const width = 4 + (pattern.scale * 18) * (0.65 + random() * 0.7);
    const color = index % 2 ? pattern.secondaryColor : pattern.primaryColor;
    return `<path d="M ${(-size * 0.08).toFixed(1)} ${y0.toFixed(1)} C ${(size * 0.28).toFixed(1)} ${y1.toFixed(1)}, ${(size * 0.68).toFixed(1)} ${y2.toFixed(1)}, ${(size * 1.08).toFixed(1)} ${y3.toFixed(1)}" fill="none" stroke="${escapeXml(color)}" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${width.toFixed(1)}" stroke-linecap="round"/>`;
  }).join('')}</g>`;
}

function swirlArtwork(pattern, payload, random) {
  const count = Math.round(5 + (pattern.scale * 9));
  const opacity = 0.08 + (pattern.intensity * 0.3);
  const size = payload.s;
  return `<g id="patternSwirl">${Array.from({ length: count }, (_, index) => {
    const progress = (index + 1) / (count + 1);
    const rx = size * (0.06 + progress * 0.5);
    const ry = size * (0.035 + progress * 0.34);
    const width = 3 + (pattern.scale * 10) * (0.7 + random() * 0.6);
    const rotation = Math.round((random() * 150) - 75);
    const color = index % 2 ? pattern.secondaryColor : pattern.primaryColor;
    return `<ellipse cx="${(size / 2).toFixed(1)}" cy="${(size / 2).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${escapeXml(color)}" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${width.toFixed(1)}" transform="rotate(${rotation} ${(size / 2).toFixed(1)} ${(size / 2).toFixed(1)})"/>`;
  }).join('')}</g>`;
}

export function runtimePatternArtwork(pattern, payload) {
  try {
    if (!pattern || pattern.type === 'none') return '';
    if (pattern.type === 'split') return splitArtwork(pattern);
    const random = randomFactory(seedFrom(pattern, payload));
    if (pattern.type === 'speckle') return speckleArtwork(pattern, payload, random);
    if (pattern.type === 'marble') return marbleArtwork(pattern, payload, random);
    if (pattern.type === 'swirl') return swirlArtwork(pattern, payload, random);
    return '';
  } catch (error) {
    console.error('Failed to build runtime surface-pattern artwork:', error);
    return '';
  }
}
