import { safeTrayImageUrl } from './tray-image.mjs';

const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_DICE_COLOR = '#b91c1c';
const DEFAULT_TRAY_COLOR = '#000000';
const DEFAULT_TRAY_SHADOW = 'inset 0 6px 28px rgba(0,0,0,.55),0 22px 60px rgba(0,0,0,.22)';
export const LIVE_TRAY_CSS = '.appearance-v2-active #dice-tray{background:var(--appearance-v2-tray-bg)!important;box-shadow:var(--appearance-v2-tray-shadow)!important}';

function safeHex(value, fallback) { const text = String(value || ''); return HEX.test(text) ? text : fallback; }
function cloneRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item && typeof item === 'object' ? { ...item } : item]));
}
export function buildLivePhysicsConfig(runtime, legacyThemeColor = DEFAULT_DICE_COLOR) {
  const fallback = { mode: 'default', themeColor: safeHex(legacyThemeColor, DEFAULT_DICE_COLOR), runtimeThemes: null, diceBoxOptions: {} };
  if (runtime?.mode !== 'custom') return fallback;
  const runtimeThemes = cloneRecord(runtime.runtimeThemes); const externalThemes = cloneRecord(runtime.externalThemes);
  if (!Object.keys(runtimeThemes).length || !Object.keys(externalThemes).length) return fallback;
  return {
    mode: 'custom', themeColor: safeHex(runtime.defaultThemeColor, fallback.themeColor), runtimeThemes,
    diceBoxOptions: { externalThemes, offscreen: false },
  };
}
export function buildLiveTrayVisual(runtime) {
  if (runtime?.mode !== 'custom') return { active: false, background: null, shadow: null };
  const color = safeHex(runtime?.tray?.color, DEFAULT_TRAY_COLOR); const glow = runtime?.tray?.glow;
  const intensity = Number.isFinite(glow?.intensity) ? Math.min(1, Math.max(0, glow.intensity)) : 0;
  const glowEnabled = Boolean(glow?.enabled) && intensity > 0; const glowColor = safeHex(glow?.color, '#ffffff');
  const glowBlur = Math.round(14 + (34 * intensity)); const imageUrl = safeTrayImageUrl(runtime?.tray?.image);
  const background = imageUrl
    ? `linear-gradient(rgba(2,6,23,.28),rgba(2,6,23,.28)),url("${imageUrl}") center/cover no-repeat,${color}`
    : `radial-gradient(circle at 50% 35%, ${color}, #020617 82%)`;
  return {
    active: true, background, imageUrl,
    shadow: glowEnabled ? `${DEFAULT_TRAY_SHADOW},0 0 ${glowBlur}px ${glowColor}` : DEFAULT_TRAY_SHADOW,
  };
}
function ensureLiveTrayStyle(documentRef) {
  if (!documentRef?.head || documentRef.getElementById?.('appearance-v2-live-style')) return;
  const style = documentRef.createElement('style'); style.id = 'appearance-v2-live-style'; style.textContent = LIVE_TRAY_CSS; documentRef.head.appendChild(style);
}
export function applyLiveTrayAppearance(runtime, { documentRef } = {}) {
  const visual = buildLiveTrayVisual(runtime); const doc = documentRef ?? (typeof document === 'undefined' ? null : document); const body = doc?.body;
  if (!body) return visual;
  ensureLiveTrayStyle(doc); body.classList.toggle('appearance-v2-active', visual.active);
  if (visual.active) {
    body.style.setProperty('--appearance-v2-tray-bg', visual.background); body.style.setProperty('--appearance-v2-tray-shadow', visual.shadow);
  } else {
    body.style.removeProperty('--appearance-v2-tray-bg'); body.style.removeProperty('--appearance-v2-tray-shadow');
  }
  return visual;
}
