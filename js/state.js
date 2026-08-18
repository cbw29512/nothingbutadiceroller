export const state = {
  selectedDice: [],
  d20Mode: 'normal',
  keepDice: false,
  hasRolled: false,
  soundEnabled: true,
  trayTheme: 'tray-green_felt',
  dieSkin: 'skin-ruby_red',
  history: []
};

// Default custom face mappings: 20 -> 💀, 1 -> ☠️
export let activeCustomFaces = { "20": "💀", "1": "☠️" };

export function loadPreferences() {
  const savedTheme = localStorage.getItem('trayTheme');
  const savedSkin = localStorage.getItem('dieSkin');
  const savedHistory = localStorage.getItem('rollHistory');

  if (savedTheme) state.trayTheme = savedTheme;
  if (savedSkin) state.dieSkin = savedSkin;
  if (savedHistory) {
    try { state.history = JSON.parse(savedHistory); } catch(e) { state.history = []; }
  }

  document.body.className = state.trayTheme + ' ' + state.dieSkin;
}

export function savePreferences() {
  localStorage.setItem('trayTheme', state.trayTheme);
  localStorage.setItem('dieSkin', state.dieSkin);
  localStorage.setItem('rollHistory', JSON.stringify(state.history));
  document.body.className = state.trayTheme + ' ' + state.dieSkin;
}