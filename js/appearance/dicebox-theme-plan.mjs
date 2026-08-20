import { CANONICAL_DICE } from './defaults.mjs';

export const DICEBOX_THEME_PLAN_VERSION = 1;
export const DICEBOX_BASE_THEME = 'default';
export const DICEBOX_BASE_MESH = 'default.json';

const FORBIDDEN_MECHANICS_KEYS = new Set([
  'notation', 'result', 'results', 'rng', 'random', 'roll', 'critical', 'crit',
  'advantage', 'disadvantage', 'gravity', 'mass', 'friction', 'restitution',
  'throwforce', 'spinforce', 'startingheight', 'lineardamping', 'angulardamping',
]);

function assertVisualOnly(value, path = 'themePlan') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_MECHANICS_KEYS.has(key.toLowerCase())) {
      throw new Error(`${path}.${key} is a mechanics field and cannot enter a visual theme plan.`);
    }
    assertVisualOnly(child, `${path}.${key}`);
  }
}

function assertCanonicalDice(renderPlan) {
  for (const type of Object.keys(CANONICAL_DICE)) {
    const die = renderPlan?.dice?.[type];
    if (!die) throw new Error(`Missing ${type} render instructions.`);
    if (die.shapeId !== `canonical:${type}` || die.logicalDie !== type) {
      throw new Error(`${type} must use its canonical DiceBox geometry and logical die identity.`);
    }
  }
}

function compileDie(type, die) {
  return {
    type,
    geometry: {
      meshTheme: DICEBOX_BASE_THEME,
      meshFile: DICEBOX_BASE_MESH,
      meshPolicy: 'shared-canonical-immutable',
      colliderFaceMapPolicy: 'inherit-default-immutable',
    },
    material: {
      type: 'StandardMaterial',
      bodyColor: die.style.bodyColor,
      faceColor: die.style.faceColor,
      opacity: die.style.opacity,
      glow: { ...die.style.glow },
      diffuseAtlas: { mode: 'generated', source: 'logical-face-artwork' },
      normalMap: { mode: 'inherit-default' },
      specularMap: { mode: 'inherit-default' },
    },
    faceMode: die.faceMode,
    faces: structuredClone(die.faces || {}),
  };
}

export function buildDiceBoxThemePlan(renderPlan) {
  try {
    if (!renderPlan || typeof renderPlan !== 'object') throw new Error('Appearance render plan is required.');
    assertVisualOnly(renderPlan, 'renderPlan');
    assertCanonicalDice(renderPlan);
    const plan = {
      schemaVersion: DICEBOX_THEME_PLAN_VERSION,
      sourceSetId: renderPlan.sourceSetId,
      baseTheme: DICEBOX_BASE_THEME,
      diceAvailable: Object.keys(CANONICAL_DICE),
      dice: Object.fromEntries(Object.entries(renderPlan.dice).map(([type, die]) => [type, compileDie(type, die)])),
      tray: structuredClone(renderPlan.tray),
    };
    assertVisualOnly(plan);
    return plan;
  } catch (error) {
    console.error('Failed to build DiceBox visual theme plan:', error);
    throw error;
  }
}
