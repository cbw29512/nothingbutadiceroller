import { CANONICAL_DICE } from './defaults.mjs';
import { buildDiceBoxAtlasDrawOperations } from './dicebox-atlas-renderer.mjs';
import { buildRuntimeThemeIdentity } from './runtime-theme-identity.mjs';
import { RUNTIME_THEME_VERSION, encodeRuntimeThemePayload } from './runtime-theme-codec.mjs';
import { normalizeInterior, normalizeTranslucency, simulatedResinBodyColor } from './resin-style.mjs';

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}
function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
}

export function buildDiceBoxRuntimeTheme(glyphPlan, themePlan, dieType, { size = 1024 } = {}) {
  try {
    if (!Object.hasOwn(CANONICAL_DICE, dieType)) throw new Error(`Unsupported runtime theme die type: ${dieType}`);
    const dieTheme = themePlan?.dice?.[dieType];
    if (!dieTheme) throw new Error(`Missing ${dieType} DiceBox theme instructions.`);
    const operations = buildDiceBoxAtlasDrawOperations(glyphPlan, dieType, size);
    const material = dieTheme.material || {};
    const glow = material.glowHint || {};
    const translucency = normalizeTranslucency(material.translucency, material.bodyColor);
    const interior = normalizeInterior(material.interior);
    const payload = {
      v: RUNTIME_THEME_VERSION,
      d: dieType,
      s: size,
      o: operations.map((operation) => [
        operation.text,
        operation.color,
        operation.fontId || '',
        round(operation.x),
        round(operation.y),
        round(operation.fontPx),
      ]),
      g: [Boolean(glow.enabled), String(glow.color || '#ffffff'), round(clamp01(glow.intensity))],
      r: [
        Boolean(translucency.enabled),
        round(Math.max(0.25, translucency.opacity)),
        round(clamp01(translucency.frost)),
        translucency.tintColor,
        Boolean(interior.enabled),
        interior.type,
        interior.primaryColor,
        interior.secondaryColor,
        round(clamp01(interior.density)),
        round(clamp01(interior.intensity)),
      ],
    };
    const token = encodeRuntimeThemePayload(payload);
    return {
      dieType,
      themeName: buildRuntimeThemeIdentity(dieType, token),
      basePath: `/api/dice-theme/${token}`,
      themeColor: simulatedResinBodyColor(material),
      token,
    };
  } catch (error) {
    console.error('Failed to build DiceBox runtime theme:', error);
    throw error;
  }
}

export function buildDiceBoxRuntimeThemes(glyphPlan, themePlan, options = {}) {
  try {
    return Object.fromEntries(Object.keys(CANONICAL_DICE).map((dieType) => [
      dieType,
      buildDiceBoxRuntimeTheme(glyphPlan, themePlan, dieType, options),
    ]));
  } catch (error) {
    console.error('Failed to build DiceBox runtime themes:', error);
    throw error;
  }
}
