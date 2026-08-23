export const APPEARANCE_DICEBOX_VERSION = '1.1.4';
export const DICEBOX_VENDOR_BASE = `/vendor/dice-box-${APPEARANCE_DICEBOX_VERSION}/`;
export const DICEBOX_MODULE_URL = `${DICEBOX_VENDOR_BASE}dice-box.es.min.js`;
export const DICEBOX_ASSET_PATH = `${DICEBOX_VENDOR_BASE}assets/`;
export const DICEBOX_DEFAULT_MODEL_URL = `${DICEBOX_ASSET_PATH}themes/default/default.json`;

let cachedDiceBoxClassPromise = null;

export function diceBoxOrigin(locationLike = globalThis.location) {
  const origin = String(locationLike?.origin || '').trim();
  if (!origin) throw new Error('DiceBox requires a same-origin browser location.');
  return origin;
}

export function loadSelfHostedDiceBox() {
  cachedDiceBoxClassPromise ||= import(DICEBOX_MODULE_URL).then((module) => {
    const candidate = module?.default || module?.DiceBox;
    if (typeof candidate !== 'function') throw new Error('DiceBox constructor was not exported.');
    return candidate;
  }).catch((error) => {
    cachedDiceBoxClassPromise = null;
    console.error('Self-hosted DiceBox module failed to load:', error);
    throw new Error(`Unable to load self-hosted DiceBox ${APPEARANCE_DICEBOX_VERSION}.`);
  });
  return cachedDiceBoxClassPromise;
}
