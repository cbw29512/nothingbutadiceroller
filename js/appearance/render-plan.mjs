import { CANONICAL_DICE, CUSTOM_FACE_MODE } from './defaults.mjs';
import { normalizeSurfacePattern } from './pattern-style.mjs';
import { normalizeInterior, normalizeTranslucency } from './resin-style.mjs';
import { normalizeSurfaceFinish } from './surface-style.mjs';
import { assertValidDiceSet } from './validation.mjs';

function mergeStyle(base, overrides = {}) {
  const bodyColor = overrides.bodyColor ?? base.bodyColor;
  const baseTranslucency = normalizeTranslucency(base.translucency, base.bodyColor);
  const baseInterior = normalizeInterior(base.interior);
  const baseFinish = normalizeSurfaceFinish(base.finish);
  const basePattern = normalizeSurfacePattern(base.pattern);
  return {
    bodyColor,
    faceColor: overrides.faceColor ?? base.faceColor,
    opacity: overrides.opacity ?? base.opacity,
    glow: overrides.glow ? { ...overrides.glow } : { ...base.glow },
    translucency: overrides.translucency
      ? normalizeTranslucency(overrides.translucency, bodyColor)
      : normalizeTranslucency(baseTranslucency, bodyColor),
    interior: overrides.interior ? normalizeInterior(overrides.interior) : normalizeInterior(baseInterior),
    finish: overrides.finish ? normalizeSurfaceFinish(overrides.finish) : normalizeSurfaceFinish(baseFinish),
    pattern: overrides.pattern ? normalizeSurfacePattern(overrides.pattern) : normalizeSurfacePattern(basePattern),
  };
}

function faceInstructions(die) {
  if (die.faceMode !== CUSTOM_FACE_MODE) return {};
  return Object.fromEntries(Object.entries(die.faces || {}).map(([logicalFace, face]) => [
    logicalFace,
    {
      kind: face.kind,
      value: face.value ?? null,
      assetId: face.assetId ?? null,
      color: face.color ?? null,
      fontId: face.fontId ?? null,
    },
  ]));
}

export function buildAppearanceRenderPlan(set) {
  try {
    assertValidDiceSet(set);
    const base = set.appearance.diceSet.defaultStyle;
    const dice = Object.fromEntries(Object.keys(CANONICAL_DICE).map((type) => {
      const source = set.appearance.diceSet.dice[type];
      return [type, {
        shapeId: source.shapeId,
        logicalDie: source.logicalDie,
        faceMode: source.faceMode,
        style: mergeStyle(base, source.styleOverrides),
        faces: faceInstructions(source),
      }];
    }));
    return {
      schemaVersion: 1,
      sourceSetId: set.id,
      dice,
      tray: {
        color: set.appearance.tray.color,
        image: set.appearance.tray.image ? structuredClone(set.appearance.tray.image) : null,
        glow: { ...set.appearance.tray.glow },
      },
    };
  } catch (error) {
    console.error('Failed to build appearance render plan:', error);
    throw error;
  }
}
