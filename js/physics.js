import { decorateDiceBoxNotation } from './appearance/dicebox-visual-adapter.mjs';
import { SYSTEM_DEFAULT_DICE_SET } from './appearance/defaults.mjs';
import { buildLivePhysicsConfig } from './appearance/live-integration.mjs';
import {
  APPEARANCE_DICEBOX_VERSION as DICEBOX_VERSION,
  DICEBOX_ASSET_PATH,
  diceBoxOrigin,
  loadSelfHostedDiceBox,
} from './appearance/dicebox-self-host.mjs';

let diceBox = null;
let liveRuntimeThemes = null;
const SYSTEM_DEFAULT_DICE_COLOR = SYSTEM_DEFAULT_DICE_SET.appearance.diceSet.defaultStyle.bodyColor;
let liveThemeColor = SYSTEM_DEFAULT_DICE_COLOR;

function getDiceScale() {
  try {
    return window.matchMedia?.('(max-width: 700px)').matches ? 14 : 9;
  } catch (err) {
    console.warn('Unable to detect viewport for dice scale:', err);
    return 9;
  }
}

export async function initDicePhysics(themeColor = SYSTEM_DEFAULT_DICE_COLOR, appearanceRuntime = null) {
  try {
    const DiceBox = await loadSelfHostedDiceBox();
    console.info(`DiceBox ${DICEBOX_VERSION} loaded from same-origin vendor runtime.`);
    const liveAppearance = buildLivePhysicsConfig(appearanceRuntime, themeColor);
    liveRuntimeThemes = liveAppearance.runtimeThemes;
    liveThemeColor = liveAppearance.themeColor;
    diceBox = new DiceBox({
      container: '#dice-tray',
      assetPath: DICEBOX_ASSET_PATH,
      origin: diceBoxOrigin(window.location),
      theme: 'default',
      themeColor: liveThemeColor,
      gravity: 1,
      mass: 1,
      friction: 0.8,
      restitution: 0.15,
      linearDamping: 0.45,
      angularDamping: 0.4,
      startingHeight: 8,
      spinForce: 5,
      throwForce: 5,
      scale: getDiceScale(),
      ...liveAppearance.diceBoxOptions,
    });

    await diceBox.init();
    console.info('DiceBox 3D physics initialized.');
    return true;
  } catch (err) {
    diceBox = null;
    liveRuntimeThemes = null;
    liveThemeColor = SYSTEM_DEFAULT_DICE_COLOR;
    console.error('DiceBox initialization failed:', err);
    throw err;
  }
}

export function isPhysicsReady() {
  return Boolean(diceBox);
}

async function rollDefaultFallback(notation, themeColor, originalError) {
  void themeColor;
  console.warn('Custom dice appearance failed; retrying the same roll with Default Dice.', originalError);
  liveRuntimeThemes = null;
  liveThemeColor = SYSTEM_DEFAULT_DICE_COLOR;
  await Promise.resolve(diceBox.updateConfig({
    theme: 'default',
    themeColor: liveThemeColor,
    scale: getDiceScale(),
  }));
  return diceBox.roll(notation);
}

export async function rollPhysics(notation, themeColor) {
  void themeColor;
  if (!diceBox) throw new Error('DiceBox is not initialized.');
  if (!Array.isArray(notation) || notation.length === 0) {
    throw new Error('No valid dice notation to roll.');
  }

  const usesCustomAppearance = Boolean(liveRuntimeThemes);
  try {
    await Promise.resolve(diceBox.updateConfig({
      themeColor: liveThemeColor,
      scale: getDiceScale(),
    }));
    const liveNotation = usesCustomAppearance
      ? decorateDiceBoxNotation(notation, liveRuntimeThemes)
      : notation;
    return await diceBox.roll(liveNotation);
  } catch (err) {
    if (usesCustomAppearance) {
      try {
        return await rollDefaultFallback(notation, themeColor, err);
      } catch (fallbackError) {
        console.error('Default Dice fallback roll also failed:', fallbackError);
        throw fallbackError;
      }
    }
    console.error('DiceBox roll failed:', err);
    throw err;
  }
}

export async function clearPhysics() {
  if (!diceBox) return;
  try {
    await Promise.resolve(diceBox.clear());
  } catch (err) {
    console.error('DiceBox clear failed:', err);
  }
}
