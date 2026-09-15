import { normalizeHistoryRecord } from './history-records.mjs';

export const PREFERENCES_SCHEMA_VERSION = 1;

export const state = {
  selectedDice: [],
  d20Mode: 'normal',
  modifier: 0,
  keepDice: false,
  hasRolled: false,
  soundEnabled: true,
  trayTheme: 'tray-green_felt',
  dieSkin: 'skin-ruby_red',
  customAppearance: null,
  history: [],
  physicsReady: false,
  rolling: false,
};

const KEYS = {
  schemaVersion: 'preferencesSchemaVersion',
  trayTheme: 'trayTheme',
  dieSkin: 'dieSkin',
  customAppearance: 'customAppearance',
  history: 'rollHistory',
  soundEnabled: 'soundEnabled',
  keepDice: 'keepDice',
};

function safeImageUrl(value) {
  try {
    const url = String(value || '');
    return url.startsWith('/api/theme-image?') || url.startsWith('/.netlify/blobs/') ? url : null;
  } catch (error) {
    console.error('Failed to validate saved appearance image URL:', error);
    return null;
  }
}

function safeAppearance(raw) {
  try {
    if (!raw || typeof raw !== 'object') return null;
    return {
      themeId: String(raw.themeId || '').slice(0, 120),
      ownerId: String(raw.ownerId || '').slice(0, 120),
      name: String(raw.name || 'Custom Theme').slice(0, 80),
      trayName: String(raw.trayName || 'Custom Tray').slice(0, 80),
      trayColor: /^#[0-9a-f]{6}$/i.test(String(raw.trayColor || '')) ? raw.trayColor : '#0f172a',
      diceColor: /^#[0-9a-f]{6}$/i.test(String(raw.diceColor || '')) ? raw.diceColor : '#b91c1c',
      imageUrl: safeImageUrl(raw.imageUrl),
      enableGlow: Boolean(raw.enableGlow),
      glowColor: /^#[0-9a-f]{6}$/i.test(String(raw.glowColor || '')) ? raw.glowColor : '#00ff66',
      isPublic: Boolean(raw.isPublic),
    };
  } catch (error) {
    console.error('Failed to normalize saved appearance:', error);
    return null;
  }
}

function normalizeSavedHistory(rawHistory) {
  try {
    if (!Array.isArray(rawHistory)) return [];
    return rawHistory.map(normalizeHistoryRecord).filter(Boolean).slice(0, 30);
  } catch (error) {
    console.error('Failed to normalize saved roll history:', error);
    return [];
  }
}

export function applyBodyTheme() {
  try {
    const trayClasses = [...document.body.classList].filter(name => name.startsWith('tray-'));
    const skinClasses = [...document.body.classList].filter(name => name.startsWith('skin-'));
    document.body.classList.remove(...trayClasses, ...skinClasses);
    document.body.classList.add(state.trayTheme, state.dieSkin);

    const tray = document.getElementById('dice-tray');
    if (state.customAppearance) {
      const appearance = safeAppearance(state.customAppearance);
      state.customAppearance = appearance;
      const base = appearance?.trayColor || '#0f172a';
      const background = appearance?.imageUrl
        ? `linear-gradient(rgba(2,6,23,.12),rgba(2,6,23,.12)),url("${appearance.imageUrl}") center/cover no-repeat`
        : `radial-gradient(circle at 50% 35%, ${base}, #020617 82%)`;
      document.body.style.setProperty('--tray-bg', background);
      if (tray) {
        tray.style.boxShadow = appearance?.enableGlow
          ? `inset 0 6px 28px rgba(0,0,0,.55),0 0 38px ${appearance.glowColor}`
          : '';
      }
    } else {
      document.body.style.removeProperty('--tray-bg');
      if (tray) tray.style.boxShadow = '';
    }
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
    state.d20Mode = 'normal';
    state.modifier = 0;
    localStorage.removeItem('d20Mode');

    const savedAppearance = localStorage.getItem(KEYS.customAppearance);
    state.customAppearance = savedAppearance ? safeAppearance(JSON.parse(savedAppearance)) : null;

    const savedHistory = localStorage.getItem(KEYS.history);
    state.history = normalizeSavedHistory(savedHistory ? JSON.parse(savedHistory) : []);
  } catch (err) {
    console.error('Failed to load preferences; defaults will be used:', err);
    state.history = [];
    state.customAppearance = null;
    state.d20Mode = 'normal';
    state.modifier = 0;
  } finally {
    applyBodyTheme();
  }
}

export function savePreferences() {
  try {
    state.history = normalizeSavedHistory(state.history);
    localStorage.setItem(KEYS.schemaVersion, String(PREFERENCES_SCHEMA_VERSION));
    localStorage.setItem(KEYS.trayTheme, state.trayTheme);
    localStorage.setItem(KEYS.dieSkin, state.dieSkin);
    localStorage.setItem(KEYS.history, JSON.stringify(state.history));
    localStorage.setItem(KEYS.soundEnabled, String(state.soundEnabled));
    localStorage.setItem(KEYS.keepDice, String(state.keepDice));
    if (state.customAppearance) {
      localStorage.setItem(KEYS.customAppearance, JSON.stringify(safeAppearance(state.customAppearance)));
    } else {
      localStorage.removeItem(KEYS.customAppearance);
    }
    applyBodyTheme();
  } catch (err) {
    console.error('Failed to save preferences:', err);
  }
}
