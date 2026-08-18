import DiceBox from 'https://unpkg.com/@3d-dice/dice-box@1.1.5/dist/dice-box.es.min.js';

let diceBox = null;

export async function initDicePhysics(themeColor = '#b91c1c') {
  try {
    diceBox = new DiceBox({
      container: '#dice-tray',
      assetPath: 'assets/',
      origin: 'https://unpkg.com/@3d-dice/dice-box@1.1.5/dist/',
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
      scale: 5
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
  if (!Array.isArray(notation) || notation.length === 0) throw new Error('No valid dice notation to roll.');

  try {
    await Promise.resolve(diceBox.updateConfig({ themeColor }));
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
