import { normalizeResinStyle, rgba, simulatedResinBodyColor } from './resin-style.mjs';

function glitter(interior) {
  const a = rgba(interior.primaryColor, 0.82);
  const b = rgba(interior.secondaryColor, 0.74);
  return [
    `radial-gradient(circle at 18% 22%, ${a} 0 2%, transparent 3%)`,
    `radial-gradient(circle at 73% 19%, ${b} 0 1.8%, transparent 3%)`,
    `radial-gradient(circle at 34% 68%, ${b} 0 2.2%, transparent 3.4%)`,
    `radial-gradient(circle at 82% 72%, ${a} 0 1.6%, transparent 3%)`,
    `radial-gradient(circle at 55% 43%, ${a} 0 1.2%, transparent 2.5%)`,
  ];
}

function flakes(interior) {
  const a = rgba(interior.primaryColor, 0.7);
  const b = rgba(interior.secondaryColor, 0.64);
  return [
    `linear-gradient(32deg, transparent 15%, ${a} 16% 20%, transparent 21% 48%, ${b} 49% 54%, transparent 55%)`,
    `linear-gradient(142deg, transparent 30%, ${b} 31% 35%, transparent 36% 67%, ${a} 68% 73%, transparent 74%)`,
  ];
}

function smoke(interior) {
  const a = rgba(interior.primaryColor, 0.38);
  const b = rgba(interior.secondaryColor, 0.34);
  return [
    `radial-gradient(ellipse at 28% 64%, ${a} 0 12%, transparent 40%)`,
    `radial-gradient(ellipse at 66% 35%, ${b} 0 14%, transparent 44%)`,
    `radial-gradient(ellipse at 55% 74%, ${a} 0 8%, transparent 34%)`,
  ];
}

function nebula(interior) {
  const a = rgba(interior.primaryColor, 0.52);
  const b = rgba(interior.secondaryColor, 0.46);
  return [
    `radial-gradient(circle at 30% 62%, ${a} 0 9%, transparent 35%)`,
    `radial-gradient(circle at 72% 34%, ${b} 0 11%, transparent 38%)`,
    `radial-gradient(circle at 52% 48%, rgba(255,255,255,.55) 0 1%, transparent 2.5%)`,
    `radial-gradient(circle at 80% 70%, rgba(255,255,255,.5) 0 1%, transparent 2.2%)`,
  ];
}

function bubbles(interior) {
  const a = rgba(interior.primaryColor, 0.55);
  const b = rgba(interior.secondaryColor, 0.45);
  return [
    `radial-gradient(circle at 22% 28%, transparent 0 7%, ${a} 8% 9%, transparent 10%)`,
    `radial-gradient(circle at 69% 27%, transparent 0 5%, ${b} 6% 7%, transparent 8%)`,
    `radial-gradient(circle at 42% 72%, transparent 0 8%, ${a} 9% 10%, transparent 11%)`,
    `radial-gradient(circle at 78% 68%, transparent 0 4%, ${b} 5% 6%, transparent 7%)`,
  ];
}

function effectLayers(interior) {
  if (!interior.enabled || interior.type === 'none') return [];
  if (interior.type === 'glitter') return glitter(interior);
  if (interior.type === 'flakes') return flakes(interior);
  if (interior.type === 'smoke') return smoke(interior);
  if (interior.type === 'nebula') return nebula(interior);
  if (interior.type === 'bubbles') return bubbles(interior);
  return [];
}

export function buildResinPreviewBackground(style = {}) {
  const { translucency, interior } = normalizeResinStyle(style);
  if (!translucency.enabled && !interior.enabled) return style.bodyColor || '#b91c1c';
  const layers = effectLayers(interior);
  const body = simulatedResinBodyColor(style);
  if (translucency.enabled) {
    layers.push(`linear-gradient(145deg, rgba(255,255,255,.34), transparent 32%, rgba(255,255,255,.08) 58%, rgba(0,0,0,.18))`);
    layers.push(`linear-gradient(${rgba(body, Math.max(0.38, translucency.opacity))}, ${rgba(translucency.tintColor, Math.max(0.34, translucency.opacity * 0.82))})`);
  } else {
    layers.push(body);
  }
  return layers.join(',');
}

export function buildResinPreviewShadow(style = {}) {
  const { translucency, interior } = normalizeResinStyle(style);
  const glow = style.glow?.enabled ? `0 0 18px ${style.glow.color}` : '';
  if (!translucency.enabled && !interior.enabled) return glow || 'none';
  const resin = `inset 0 0 18px rgba(255,255,255,.22), inset 0 -18px 26px rgba(0,0,0,.2)`;
  return [resin, glow].filter(Boolean).join(', ');
}
