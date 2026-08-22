import { CANONICAL_DICE } from './defaults.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';
import { buildDiceBoxGlyphPlan } from './dicebox-glyph-plan.mjs';
import { buildDiceBoxRuntimeThemes } from './dicebox-runtime-theme.mjs';
import { buildDiceBoxThemePlan } from './dicebox-theme-plan.mjs';

function dieTypeForSides(sides) {
  if (Number.isInteger(sides)) return `d${sides}`;
  const value = String(sides || '').toLowerCase();
  return value.startsWith('d') ? value : `d${value}`;
}

export function decorateDiceBoxNotation(notation, runtimeThemes) {
  try {
    if (!Array.isArray(notation)) throw new Error('Dice notation must be an array.');
    return notation.map((group) => {
      const original = structuredClone(group);
      const dieType = dieTypeForSides(group?.sides);
      const visual = runtimeThemes?.[dieType];
      if (!visual || !Object.hasOwn(CANONICAL_DICE, dieType)) return original;
      return { ...original, theme: visual.themeName, themeColor: visual.themeColor };
    });
  } catch (error) {
    console.error('Failed to decorate DiceBox notation with visual themes:', error);
    throw error;
  }
}

export function buildExternalThemeMap(runtimeThemes) {
  try {
    return Object.fromEntries(Object.values(runtimeThemes || {}).map((theme) => [theme.themeName, theme.basePath]));
  } catch (error) {
    console.error('Failed to build DiceBox external theme map:', error);
    throw error;
  }
}

export function buildDiceBoxVisualBundle(set, modelData) {
  try {
    const renderPlan = buildAppearanceRenderPlan(set);
    const themePlan = buildDiceBoxThemePlan(renderPlan);
    const glyphPlan = buildDiceBoxGlyphPlan(renderPlan, modelData);
    const runtimeThemes = buildDiceBoxRuntimeThemes(glyphPlan, themePlan);
    return {
      sourceSetId: set.id,
      runtimeThemes,
      externalThemes: buildExternalThemeMap(runtimeThemes),
      tray: structuredClone(renderPlan.tray),
    };
  } catch (error) {
    console.error('Failed to build DiceBox visual bundle:', error);
    throw error;
  }
}
