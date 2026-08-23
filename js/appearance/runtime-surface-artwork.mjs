function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function runtimeSurfaceSettings(payload) {
  try {
    if (!payload || payload.v < 4 || !Array.isArray(payload.f)) {
      return { type: 'standard', accentColor: '#ffffff', intensity: 0.55 };
    }
    return {
      type: String(payload.f[0]),
      accentColor: String(payload.f[1]),
      intensity: Number(payload.f[2]),
    };
  } catch (error) {
    console.error('Failed to read runtime surface settings:', error);
    return { type: 'standard', accentColor: '#ffffff', intensity: 0.55 };
  }
}

export function runtimeSurfaceDefs(surface) {
  try {
    const accent = escapeXml(surface.accentColor);
    const strength = Math.max(0, Math.min(1, surface.intensity));
    if (surface.type === 'satin') {
      return `<linearGradient id="surfaceSatin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="${(0.08 + strength * 0.16).toFixed(2)}"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.72" stop-color="${accent}" stop-opacity="${(0.04 + strength * 0.08).toFixed(2)}"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`;
    }
    if (surface.type === 'gloss') {
      return `<linearGradient id="surfaceGloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="${(0.2 + strength * 0.28).toFixed(2)}"/><stop offset="0.18" stop-color="#ffffff" stop-opacity="${(0.08 + strength * 0.16).toFixed(2)}"/><stop offset="0.42" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.82" stop-color="#ffffff" stop-opacity="${(0.04 + strength * 0.1).toFixed(2)}"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`;
    }
    if (surface.type === 'metallic') {
      return `<linearGradient id="surfaceMetallic" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="${(0.05 + strength * 0.08).toFixed(2)}"/><stop offset="0.28" stop-color="#ffffff" stop-opacity="${(0.08 + strength * 0.18).toFixed(2)}"/><stop offset="0.52" stop-color="${accent}" stop-opacity="${(0.14 + strength * 0.28).toFixed(2)}"/><stop offset="0.75" stop-color="#ffffff" stop-opacity="${(0.05 + strength * 0.12).toFixed(2)}"/><stop offset="1" stop-color="#000000" stop-opacity="${(0.05 + strength * 0.08).toFixed(2)}"/></linearGradient>`;
    }
    if (surface.type === 'pearl') {
      return `<radialGradient id="surfacePearl" cx="28%" cy="24%" r="82%"><stop offset="0" stop-color="${accent}" stop-opacity="${(0.12 + strength * 0.26).toFixed(2)}"/><stop offset="0.38" stop-color="#ffffff" stop-opacity="${(0.08 + strength * 0.18).toFixed(2)}"/><stop offset="0.72" stop-color="${accent}" stop-opacity="${(0.05 + strength * 0.12).toFixed(2)}"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`;
    }
    return '';
  } catch (error) {
    console.error('Failed to build runtime surface defs:', error);
    return '';
  }
}

export function runtimeSurfaceArtwork(surface) {
  try {
    const strength = Math.max(0, Math.min(1, surface.intensity));
    if (surface.type === 'matte') {
      return `<rect width="100%" height="100%" fill="#000000" fill-opacity="${(0.03 + strength * 0.08).toFixed(2)}"/>`;
    }
    if (surface.type === 'satin') return '<rect width="100%" height="100%" fill="url(#surfaceSatin)"/>';
    if (surface.type === 'gloss') return '<rect width="100%" height="100%" fill="url(#surfaceGloss)"/>';
    if (surface.type === 'metallic') return '<rect width="100%" height="100%" fill="url(#surfaceMetallic)"/>';
    if (surface.type === 'pearl') return '<rect width="100%" height="100%" fill="url(#surfacePearl)"/>';
    return '';
  } catch (error) {
    console.error('Failed to build runtime surface artwork:', error);
    return '';
  }
}
