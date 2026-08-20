import { createUserDiceSet } from './schema.mjs';
import { CUSTOM_FACE_MODE } from './defaults.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';
import { buildDiceBoxGlyphPlan } from './dicebox-glyph-plan.mjs';
import { buildDiceBoxRuntimeTheme } from './dicebox-runtime-theme.mjs';
import { buildDiceBoxThemePlan } from './dicebox-theme-plan.mjs';
import { APPEARANCE_DICEBOX_VERSION, loadCanonicalDiceBoxModel } from './dicebox-model-loader.mjs';

const MODULE_SOURCES = [
  `https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@${APPEARANCE_DICEBOX_VERSION}/dist/dice-box.es.min.js`,
  `https://unpkg.com/@3d-dice/dice-box@${APPEARANCE_DICEBOX_VERSION}/dist/dice-box.es.min.js`,
];
let diceBox = null;
let runtimeTheme = null;
const q = (id) => document.getElementById(id);

function proofSet() {
  const set = createUserDiceSet({ id: 'appearance-proof', ownerId: 'proof-harness', name: 'Visual Independence Proof' });
  const d20 = set.appearance.diceSet.dice.d20;
  d20.faceMode = CUSTOM_FACE_MODE;
  d20.styleOverrides = { bodyColor: '#b91c1c', faceColor: '#a855f7' };
  d20.faces = Object.fromEntries(Array.from({ length: 20 }, (_, index) => {
    const result = index + 1;
    return [String(result), result === 20
      ? { kind: 'icon', value: 'skull', color: '#a855f7' }
      : { kind: 'text', value: '1', color: '#a855f7' }];
  }));
  return set;
}

async function loadDiceBoxClass() {
  const failures = [];
  for (const source of MODULE_SOURCES) {
    try {
      const module = await import(source);
      const candidate = module?.default || module?.DiceBox;
      if (typeof candidate !== 'function') throw new Error('DiceBox constructor missing.');
      return candidate;
    } catch (error) {
      failures.push(`${source}: ${error?.message || error}`);
    }
  }
  throw new Error(`Unable to load DiceBox ${APPEARANCE_DICEBOX_VERSION}. ${failures.join(' | ')}`);
}

function scale() {
  return window.matchMedia?.('(max-width:700px)').matches ? 14 : 9;
}

function valuesFrom(results) {
  const values = [];
  for (const item of Array.isArray(results) ? results : []) {
    const rolls = Array.isArray(item?.rolls) ? item.rolls : [item];
    rolls.forEach((roll) => {
      const value = Number(roll?.value ?? roll?.result);
      if (Number.isFinite(value)) values.push(value);
    });
  }
  return values;
}

function enableButtons(enabled) {
  q('proof-roll-one').disabled = !enabled;
  q('proof-roll-ten').disabled = !enabled;
}

async function proofRoll(qty) {
  try {
    enableButtons(false);
    q('proof-status').textContent = `Rolling ${qty} canonical d20${qty === 1 ? '' : 's'}…`;
    const results = await diceBox.roll([{ qty, sides: 20 }], {
      theme: runtimeTheme.themeName,
      themeColor: runtimeTheme.themeColor,
    });
    const values = valuesFrom(results);
    q('proof-result').textContent = `DiceBox engine result${values.length === 1 ? '' : 's'}: ${values.join(', ') || 'none'}`;
    q('proof-expected').textContent = `Expected visible face art: ${values.map((value) => value === 20 ? '☠' : '1').join(', ') || 'none'}. Numerical results remain unchanged.`;
    q('proof-status').textContent = 'Proof roll complete. Compare the visible face artwork to the engine result above.';
  } catch (error) {
    console.error('Appearance proof roll failed:', error);
    q('proof-status').textContent = `Proof roll failed: ${error.message}`;
  } finally {
    enableButtons(Boolean(diceBox));
  }
}

async function initialize() {
  try {
    const [DiceBox, modelData] = await Promise.all([loadDiceBoxClass(), loadCanonicalDiceBoxModel()]);
    const renderPlan = buildAppearanceRenderPlan(proofSet());
    const themePlan = buildDiceBoxThemePlan(renderPlan);
    const glyphPlan = buildDiceBoxGlyphPlan(renderPlan, modelData);
    runtimeTheme = buildDiceBoxRuntimeTheme(glyphPlan, themePlan, 'd20');
    diceBox = new DiceBox({
      container: '#appearance-proof-tray',
      assetPath: 'assets/',
      origin: `https://unpkg.com/@3d-dice/dice-box@${APPEARANCE_DICEBOX_VERSION}/dist/`,
      theme: runtimeTheme.themeName,
      themeColor: runtimeTheme.themeColor,
      externalThemes: { [runtimeTheme.themeName]: runtimeTheme.basePath },
      offscreen: false,
      gravity: 1, mass: 1, friction: 0.8, restitution: 0.15,
      linearDamping: 0.45, angularDamping: 0.4, startingHeight: 8,
      spinForce: 5, throwForce: 5, scale: scale(),
    });
    await diceBox.init();
    q('proof-roll-one').addEventListener('click', () => proofRoll(1));
    q('proof-roll-ten').addEventListener('click', () => proofRoll(10));
    enableButtons(true);
    q('proof-status').textContent = `DiceBox ${APPEARANCE_DICEBOX_VERSION} proof ready. Canonical collider intact; custom SVG face atlas loaded.`;
  } catch (error) {
    console.error('Appearance proof harness failed to initialize:', error);
    q('proof-status').textContent = `Proof harness failed: ${error.message}`;
  }
}

initialize();
