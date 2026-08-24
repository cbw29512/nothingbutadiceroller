import { SYSTEM_DEFAULT_DICE_SET, SYSTEM_DEFAULT_DICE_SET_ID } from './defaults.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';
import { buildDiceBoxVisualBundle } from './dicebox-visual-adapter.mjs';
import { loadCanonicalDiceBoxModel } from './dicebox-model-loader.mjs';
import { getActiveDiceSetId, getActiveDiceSetSnapshot } from './studio-persistence.mjs';
import { validateDiceSet } from './validation.mjs';

export function resolveStoredActiveDiceSet(storage = localStorage) {
  try {
    const activeId = getActiveDiceSetId(storage);
    if (activeId === SYSTEM_DEFAULT_DICE_SET_ID) return SYSTEM_DEFAULT_DICE_SET;
    const snapshot = getActiveDiceSetSnapshot(storage);
    if (!snapshot || snapshot.id !== activeId || !validateDiceSet(snapshot).ok) return SYSTEM_DEFAULT_DICE_SET;
    return snapshot;
  } catch (error) {
    console.error('Failed to resolve stored active appearance:', error);
    return SYSTEM_DEFAULT_DICE_SET;
  }
}

function defaultRuntime(reason = null) {
  const renderPlan = buildAppearanceRenderPlan(SYSTEM_DEFAULT_DICE_SET);
  return {
    set: SYSTEM_DEFAULT_DICE_SET,
    mode: 'default',
    reason,
    runtimeThemes: {},
    externalThemes: {},
    tray: renderPlan.tray,
    defaultThemeColor: renderPlan.dice.d20.style.bodyColor,
  };
}

export async function prepareActiveDiceAppearance({
  storage = localStorage,
  modelLoader = loadCanonicalDiceBoxModel,
  allowCustom = true,
} = {}) {
  try {
    if (!allowCustom) return defaultRuntime('Offline mode uses immutable Default Dice.');
    const set = resolveStoredActiveDiceSet(storage);
    if (set.systemOwned) return defaultRuntime();
    const modelData = await modelLoader();
    const bundle = buildDiceBoxVisualBundle(set, modelData);
    return {
      set,
      mode: 'custom',
      reason: null,
      runtimeThemes: bundle.runtimeThemes,
      externalThemes: bundle.externalThemes,
      tray: bundle.tray,
      defaultThemeColor: set.appearance.diceSet.defaultStyle.bodyColor,
    };
  } catch (error) {
    console.error('Custom appearance preparation failed; using immutable Default Dice:', error);
    return defaultRuntime(error?.message || 'Custom appearance preparation failed.');
  }
}
