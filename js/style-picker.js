import { state, savePreferences } from './state.js';
import { TRAY_THEMES, DIE_SKINS } from './utils.js';

function createLabel(name) {
  const label = document.createElement('span');
  label.className = 'theme-choice-label';
  label.textContent = name;
  return label;
}

function createTrayButton(theme, onSkinChange) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `swatch-btn theme-choice ${theme.id} ${!state.customAppearance && state.trayTheme === theme.id ? 'active' : ''}`.trim();
  button.setAttribute('aria-pressed', String(!state.customAppearance && state.trayTheme === theme.id));

  const preview = document.createElement('span');
  preview.className = 'theme-preview';
  preview.setAttribute('aria-hidden', 'true');
  button.append(preview, createLabel(theme.name));

  button.addEventListener('click', () => {
    state.customAppearance = null;
    state.trayTheme = theme.id;
    savePreferences();
    initStylePicker(onSkinChange);
  });
  return button;
}

function createSkinButton(skin, onSkinChange) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `swatch-btn theme-choice ${!state.customAppearance && state.dieSkin === skin.id ? 'active' : ''}`.trim();
  button.setAttribute('aria-pressed', String(!state.customAppearance && state.dieSkin === skin.id));

  const preview = document.createElement('span');
  preview.className = 'skin-preview';
  preview.style.background = skin.color;
  preview.setAttribute('aria-hidden', 'true');
  button.append(preview, createLabel(skin.name));

  button.addEventListener('click', async () => {
    state.customAppearance = null;
    state.dieSkin = skin.id;
    savePreferences();
    initStylePicker(onSkinChange);
    try {
      await onSkinChange?.();
    } catch (error) {
      console.error('Dice skin update failed:', error);
    }
  });
  return button;
}

export function initStylePicker(onSkinChange) {
  try {
    const trayGrid = document.getElementById('tray-themes-grid');
    const skinGrid = document.getElementById('die-skins-grid');
    if (!trayGrid || !skinGrid) return;

    trayGrid.replaceChildren(...TRAY_THEMES.map((theme) => createTrayButton(theme, onSkinChange)));
    skinGrid.replaceChildren(...DIE_SKINS.map((skin) => createSkinButton(skin, onSkinChange)));
  } catch (error) {
    console.error('Failed to initialize style picker:', error);
  }
}
