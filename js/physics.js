let diceBox = null;
let DiceBoxClass = null;

const DICEBOX_VERSION = '1.1.4';
const DICEBOX_SOURCES = [
  `https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@${DICEBOX_VERSION}/dist/dice-box.es.min.js`,
  `https://unpkg.com/@3d-dice/dice-box@${DICEBOX_VERSION}/dist/dice-box.es.min.js`,
];

async function loadDiceBoxModule() {
  if (DiceBoxClass) return DiceBoxClass;

  const failures = [];
  for (const source of DICEBOX_SOURCES) {
    try {
      const module = await import(source);
      const candidate = module?.default || module?.DiceBox;
      if (typeof candidate !== 'function') {
        throw new Error('DiceBox constructor was not exported.');
      }
      DiceBoxClass = candidate;
      console.info(`DiceBox ${DICEBOX_VERSION} loaded from ${source}`);
      return DiceBoxClass;
    } catch (err) {
      failures.push(`${source}: ${err?.message || err}`);
      console.warn('DiceBox source failed:', source, err);
    }
  }

  throw new Error(`Unable to load DiceBox ${DICEBOX_VERSION}. ${failures.join(' | ')}`);
}

function getDiceScale() {
  try {
    return window.matchMedia?.('(max-width: 700px)').matches ? 14 : 9;
  } catch (err) {
    console.warn('Unable to detect viewport for dice scale:', err);
    return 9;
  }
}

export async function initDicePhysics(themeColor = '#b91c1c') {
  try {
    const DiceBox = await loadDiceBoxModule();
    diceBox = new DiceBox({
      container: '#dice-tray',
      assetPath: 'assets/',
      origin: `https://unpkg.com/@3d-dice/dice-box@${DICEBOX_VERSION}/dist/`,
      theme: 'default',
      themeColor,
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
    });

    await diceBox.init();
    console.info('DiceBox 3D physics initialized.');
    return true;
  } catch (err) {
    diceBox = null;
    console.error('DiceBox initialization failed:', err);
    throw err;
  }
}

export function isPhysicsReady() {
  return Boolean(diceBox);
}

export async function rollPhysics(notation, themeColor) {
  if (!diceBox) throw new Error('DiceBox is not initialized.');
  if (!Array.isArray(notation) || notation.length === 0) {
    throw new Error('No valid dice notation to roll.');
  }

  try {
    await Promise.resolve(diceBox.updateConfig({
      themeColor,
      scale: getDiceScale(),
    }));
    return await diceBox.roll(notation);
  } catch (err) {
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
