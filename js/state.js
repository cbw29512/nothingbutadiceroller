export const state = {
  selectedDice: [],
  d20Mode: 'normal',
  keepDice: false,
  hasRolled: false,
  soundEnabled: true,
  trayTheme: 'tray-green_felt',
  dieSkin: 'skin-ruby_red',
  history: [],
  physicsReady: false,
  rolling: false
};

const KEYS = {
  trayTheme: 'trayTheme',
  dieSkin: 'dieSkin',
  history: 'rollHistory',
  soundEnabled: 'soundEnabled',
  keepDice: 'keepDice',
  d20Mode: 'd20Mode'
};

export function applyBodyTheme() {
  try {
    const trayClasses = [...document.body.classList].filter(name => name.startsWith('tray-'));
    const skinClasses = [...document.body.classList].filter(name => name.startsWith('skin-'));
    document.body.classList.remove(...trayClasses, ...skinClasses);
    document.body.classList.add(state.trayTheme, state.dieSkin);
  } catch (err) {
    console.error('Failed to apply saved appearance:', err);
  }
}

export function loadPreferences() {
  try {
    state.trayTheme = localStorage.getItem(KEYS.trayTheme) || state.trayTheme;
    state.dieSkin = localStorage.getItem(KEYS.dieSkin) || state.dieSkin;
    state.soundEnabled = localStorage.getItem(KEYS.soundEnabled) !== 'false';
    state.keepDice = localStorage.getItem(KEYS.keepDice) === 'true';
    state.d20Mode = localStorage.getItem(KEYS.d20Mode) || state.d20Mode;

    const savedHistory = localStorage.getItem(KEYS.history);
    state.history = savedHistory ? JSON.parse(savedHistory) : [];
    if (!Array.isArray(state.history)) state.history = [];
  } catch (err) {
    console.error('Failed to load preferences; defaults will be used:', err);
    state.history = [];
  } finally {
    applyBodyTheme();
  }
}

export function savePreferences() {
  try {
    localStorage.setItem(KEYS.trayTheme, state.trayTheme);
    localStorage.setItem(KEYS.dieSkin, state.dieSkin);
    localStorage.setItem(KEYS.history, JSON.stringify(state.history));
    localStorage.setItem(KEYS.soundEnabled, String(state.soundEnabled));
    localStorage.setItem(KEYS.keepDice, String(state.keepDice));
    localStorage.setItem(KEYS.d20Mode, state.d20Mode);
    applyBodyTheme();
  } catch (err) {
    console.error('Failed to save preferences:', err);
  }
}
