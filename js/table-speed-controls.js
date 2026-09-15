import { state } from './state.js';
import { renderPool } from './ui.js';
import {
  MAX_ROLL_MODIFIER,
  MIN_ROLL_MODIFIER,
  normalizeRollModifier,
} from './roll-modifier.mjs';

function createQuickButton(className, label, ariaLabel) {
  try {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.dataset.quickRoll = 'normal';
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.title = ariaLabel;
    return button;
  } catch (error) {
    console.error('Failed to create normal D20 quick-roll button:', error);
    return null;
  }
}

function ensureNormalD20Buttons() {
  try {
    const desktop = document.querySelector('.quick-roll-group');
    if (desktop && !desktop.querySelector('[data-quick-roll="normal"]')) {
      const button = createQuickButton('adv-btn', 'ROLL D20', 'Roll one d20');
      if (button) desktop.prepend(button);
    }

    const mobile = document.querySelector('.mobile-mode-row');
    if (mobile && !mobile.querySelector('[data-quick-roll="normal"]')) {
      const button = createQuickButton('mobile-mode-btn', 'D20', 'Roll one d20');
      if (button) mobile.prepend(button);
    }
  } catch (error) {
    console.error('Failed to add normal D20 quick-roll controls:', error);
  }
}

function createModifierControl(idPrefix, compact = false) {
  try {
    const wrapper = document.createElement('div');
    wrapper.className = `roll-modifier-control${compact ? ' compact' : ''}`;
    wrapper.dataset.rollModifierControl = 'true';

    const label = document.createElement('label');
    label.className = 'roll-modifier-label';
    label.htmlFor = `${idPrefix}-roll-modifier`;
    label.textContent = compact ? 'MOD' : 'Roll modifier';

    const group = document.createElement('div');
    group.className = 'roll-modifier-input-group';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = compact ? 'mobile-mode-btn modifier-step' : 'btn secondary modifier-step';
    minus.dataset.modifierStep = '-1';
    minus.setAttribute('aria-label', 'Decrease roll modifier');
    minus.textContent = '−';

    const input = document.createElement('input');
    input.id = `${idPrefix}-roll-modifier`;
    input.className = 'roll-modifier-input';
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = String(MIN_ROLL_MODIFIER);
    input.max = String(MAX_ROLL_MODIFIER);
    input.step = '1';
    input.value = String(state.modifier || 0);
    input.dataset.rollModifier = 'true';
    input.setAttribute('aria-label', 'Roll modifier');

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = compact ? 'mobile-mode-btn modifier-step' : 'btn secondary modifier-step';
    plus.dataset.modifierStep = '1';
    plus.setAttribute('aria-label', 'Increase roll modifier');
    plus.textContent = '+';

    group.append(minus, input, plus);
    wrapper.append(label, group);
    return wrapper;
  } catch (error) {
    console.error('Failed to create roll modifier control:', error);
    return null;
  }
}

function ensureModifierControls() {
  try {
    const quickSection = document.querySelector('.controls-panel .quick-roll-group')?.parentElement;
    if (quickSection && !document.getElementById('desktop-roll-modifier')) {
      const control = createModifierControl('desktop');
      if (control) quickSection.before(control);
    }

    const mobileMode = document.querySelector('.mobile-mode-row');
    if (mobileMode && !document.getElementById('mobile-roll-modifier')) {
      const control = createModifierControl('mobile', true);
      if (control) mobileMode.before(control);
    }
  } catch (error) {
    console.error('Failed to add roll modifier controls:', error);
  }
}

export function syncTableSpeedControls() {
  try {
    document.querySelectorAll('[data-roll-modifier]').forEach((input) => {
      if (document.activeElement !== input) input.value = String(state.modifier || 0);
    });
  } catch (error) {
    console.error('Failed to synchronize table-speed controls:', error);
  }
}

function setModifier(value) {
  try {
    state.modifier = normalizeRollModifier(value, state.modifier || 0);
    syncTableSpeedControls();
    renderPool();
    document.dispatchEvent(new Event('rollstatechange'));
  } catch (error) {
    console.error('Failed to update roll modifier:', error);
  }
}

function bindModifierControls() {
  try {
    document.querySelectorAll('[data-modifier-step]').forEach((button) => {
      button.addEventListener('click', () => {
        const step = Number(button.dataset.modifierStep || 0);
        setModifier((state.modifier || 0) + step);
      });
    });
    document.querySelectorAll('[data-roll-modifier]').forEach((input) => {
      input.addEventListener('change', () => setModifier(input.value));
      input.addEventListener('blur', () => syncTableSpeedControls());
    });
  } catch (error) {
    console.error('Failed to bind roll modifier controls:', error);
  }
}

export function initTableSpeedControls() {
  try {
    ensureNormalD20Buttons();
    ensureModifierControls();
    bindModifierControls();
    syncTableSpeedControls();
    document.addEventListener('rollstatechange', syncTableSpeedControls);
  } catch (error) {
    console.error('Failed to initialize table-speed controls:', error);
  }
}
