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
let completedDice = [];
let loadedThemeConfig = null;
const q = (id) => document.getElementById(id);

function assertProof(condition, message) {
  if (!condition) throw new Error(message);
}

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

async function decodeThemeSvg(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
}

async function preflightRuntimeTheme() {
  const configUrl = `${runtimeTheme.basePath}/theme.config.json`;
  const svgUrl = `${runtimeTheme.basePath}/diffuse.svg`;
  const [configResponse, svgResponse] = await Promise.all([fetch(configUrl), fetch(svgUrl)]);
  assertProof(configResponse.ok, `Runtime theme config returned HTTP ${configResponse.status}.`);
  assertProof(svgResponse.ok, `Runtime theme SVG returned HTTP ${svgResponse.status}.`);

  const [config, svg] = await Promise.all([configResponse.json(), svgResponse.text()]);
  assertProof(config.systemName === runtimeTheme.themeName, 'Runtime theme systemName does not match the registered external theme.');
  assertProof(Array.isArray(config.diceAvailable) && config.diceAvailable.length === 1 && config.diceAvailable[0] === 'd20',
    'Proof runtime theme must expose only d20.');
  assertProof(!Object.hasOwn(config, 'meshFile'), 'Proof runtime theme must inherit DiceBox canonical default geometry.');
  assertProof(svg.includes('☠'), 'Generated runtime SVG is missing the natural-20 skull artwork.');
  await decodeThemeSvg(svgUrl);
  return config;
}

function isD20(value) {
  return value === 'd20' || Number(value) === 20;
}

function verifyLoadedTheme() {
  const loaded = diceBox?.themesLoadedData?.[runtimeTheme.themeName] || loadedThemeConfig;
  assertProof(loaded, 'DiceBox did not retain the custom runtime theme config.');
  assertProof(loaded.systemName === runtimeTheme.themeName, 'DiceBox loaded a theme with the wrong systemName.');
  assertProof(loaded.theme === runtimeTheme.themeName, 'DiceBox selected a different theme than the proof runtime theme.');
  assertProof(loaded.meshName === 'default', 'DiceBox did not use the canonical default mesh for the proof theme.');
}

function verifyCompletedDice(qty, values) {
  assertProof(completedDice.length === qty, `Expected ${qty} completed d20${qty === 1 ? '' : 's'}, got ${completedDice.length}.`);
  for (const die of completedDice) {
    assertProof(die.theme === runtimeTheme.themeName, 'A completed die did not use the proof external theme.');
    assertProof(die.meshName === 'default', 'A completed die did not use the canonical default mesh.');
    assertProof(isD20(die.sides), 'A completed die was not a canonical d20.');
    const value = Number(die.value ?? die.result);
    assertProof(Number.isInteger(value) && value >= 1 && value <= 20, `Completed d20 returned invalid engine result: ${value}.`);
  }

  const callbackValues = completedDice.map((die) => Number(die.value ?? die.result)).sort((a, b) => a - b);
  const returnedValues = [...values].sort((a, b) => a - b);
  assertProof(JSON.stringify(callbackValues) === JSON.stringify(returnedValues),
    'DiceBox completion callbacks and roll() results disagree.');
}

async function proofRoll(qty) {
  try {
    enableButtons(false);
    completedDice = [];
    q('proof-status').textContent = `Rolling ${qty} canonical d20${qty === 1 ? '' : 's'}…`;
    const results = await diceBox.roll([{ qty, sides: 20 }], {
      theme: runtimeTheme.themeName,
      themeColor: runtimeTheme.themeColor,
    });
    const values = valuesFrom(results);
    assertProof(values.length === qty, `DiceBox returned ${values.length} engine result(s); expected ${qty}.`);
    assertProof(values.every((value) => Number.isInteger(value) && value >= 1 && value <= 20),
      'DiceBox returned a non-canonical d20 result.');
    verifyCompletedDice(qty, values);

    const visible = values.map((value) => value === 20 ? '☠' : '1');
    const natural20 = values.includes(20);
    q('proof-result').textContent = `DiceBox engine result${values.length === 1 ? '' : 's'}: ${values.join(', ')}`;
    q('proof-expected').textContent = natural20
      ? `Expected visible face art: ${visible.join(', ')}. Any die with engine result 20 must visibly show ☠.`
      : `Expected visible face art: ${visible.join(', ')}. Numerical results remain unchanged.`;
    q('proof-status').textContent = natural20
      ? 'NATURAL 20 DETECTED — MANUAL VISUAL GATE: the die with engine result 20 must visibly show ☠.'
      : 'Proof roll passed: custom theme + canonical default mesh + numeric results verified. Keep rolling until a natural 20 for the skull visual gate.';
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

    const preflightConfig = await preflightRuntimeTheme();
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
      onThemeConfigLoaded: (config) => {
        if (config?.theme === runtimeTheme?.themeName) loadedThemeConfig = config;
      },
      onDieComplete: (die) => {
        if (isD20(die?.sides)) completedDice.push({ ...die });
      },
    });

    await diceBox.init();
    verifyLoadedTheme();
    assertProof(preflightConfig.systemName === loadedThemeConfig?.systemName,
      'Preflight theme config and DiceBox-loaded theme config disagree.');

    q('proof-roll-one').addEventListener('click', () => proofRoll(1));
    q('proof-roll-ten').addEventListener('click', () => proofRoll(10));
    enableButtons(true);
    q('proof-status').textContent = `DiceBox ${APPEARANCE_DICEBOX_VERSION} proof ready. External theme ${runtimeTheme.themeName} verified on canonical default mesh. Roll until a natural 20 appears.`;
  } catch (error) {
    console.error('Appearance proof harness failed to initialize:', error);
    diceBox = null;
    enableButtons(false);
    q('proof-status').textContent = `Proof harness failed: ${error.message}`;
  }
}

initialize();
