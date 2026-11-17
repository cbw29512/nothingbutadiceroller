// Portable reference logic for the future ESP32-P4 firmware.
// State/schema comes first: session selection cannot change after confirmation.
export const SYSTEMS = Object.freeze({
  dnd5e: Object.freeze({ id: 'dnd5e', title: 'D&D 5e', dice: [4, 6, 8, 10, 12, 20, 100] }),
  custom: Object.freeze({ id: 'custom', title: 'Custom', dice: [] }),
});

export function initialState() {
  return { phase: 'choose', selectedSystemId: null, pool: [], history: [] };
}

export function selectSystem(state, systemId) {
  try {
    if (state.phase !== 'choose') throw new Error('System locked; restart required');
    if (!Object.hasOwn(SYSTEMS, systemId)) throw new Error('Unknown game system');
    return { ...state, phase: 'confirm', selectedSystemId: systemId };
  } catch (error) {
    console.error('System selection failed:', error);
    throw error;
  }
}

export function confirmSystem(state) {
  try {
    if (state.phase !== 'confirm') throw new Error('No system awaiting confirmation');
    return { ...state, phase: 'session' };
  } catch (error) {
    console.error('System confirmation failed:', error);
    throw error;
  }
}

export function cancelSelection(state) {
  try {
    if (state.phase !== 'confirm') throw new Error('Cannot cancel an active session');
    return initialState();
  } catch (error) {
    console.error('Selection cancellation failed:', error);
    throw error;
  }
}

// Node adapter for TESTS only; firmware must supply a separately verified CSPRNG.
export function secureInt(sides, randomBytes) {
  try {
    if (!Number.isSafeInteger(sides) || sides < 2 || sides > 1_000_000)
      throw new RangeError('Die sides must be 2..1,000,000');
    if (typeof randomBytes !== 'function') throw new TypeError('CSPRNG required');
    const width = 2 ** 32;
    const limit = Math.floor(width / sides) * sides;
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const bytes = randomBytes(4);
      if (!(bytes instanceof Uint8Array) || bytes.length !== 4)
        throw new TypeError('CSPRNG must return four bytes');
      const value = ((bytes[0] * 2 ** 24) + (bytes[1] << 16) +
        (bytes[2] << 8) + bytes[3]) >>> 0;
      if (value < limit) return (value % sides) + 1;
    }
    throw new Error('CSPRNG sampling exhausted');
  } catch (error) {
    console.error('Secure die roll failed:', error);
    throw error;
  }
}

export function rollPool(dice, modifier, randomBytes) {
  try {
    if (!Array.isArray(dice) || dice.length < 1 || dice.length > 1000)
      throw new RangeError('Dice count must be 1..1000');
    if (!Number.isSafeInteger(modifier)) throw new TypeError('Invalid modifier');
    const results = dice.map((die, index) => {
      if (!Number.isSafeInteger(die) || die < 2 || die > 1_000_000)
        throw new RangeError('Invalid die in pool');
      return Object.freeze({ id: index + 1, sides: die, face: secureInt(die, randomBytes) });
    });
    const subtotal = results.reduce((sum, die) => sum + die.face, 0);
    if (!Number.isSafeInteger(subtotal + modifier))
      throw new RangeError('Total exceeds safe integer bounds');
    return Object.freeze({ dice: Object.freeze(results), modifier, subtotal, total: subtotal + modifier });
  } catch (error) {
    console.error('Dice pool failed:', error);
    throw error;
  }
}
