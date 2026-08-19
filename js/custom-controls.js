import { state } from './state.js';
import { normalizeCustomSides, performCustomRoll } from './custom-roll.js';

let initialized = false;
let activeControl = null;

function ensureDesktopMarkup() {
  const selector = document.querySelector('.dice-selector');
  if (!selector || document.getElementById('desktop-custom-die-btn')) return;

  const button = document.createElement('button');
  button.id = 'desktop-custom-die-btn';
  button.type = 'button';
  button.className = 'die-btn custom-die-launch';
  button.textContent = 'CUSTOM';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'desktop-custom-die-popover');
  selector.appendChild(button);

  const popover = document.createElement('div');
  popover.id = 'desktop-custom-die-popover';
  popover.className = 'desktop-custom-die-popover hidden';
  popover.setAttribute('aria-hidden', 'true');
  popover.innerHTML = `
    <label for="desktop-custom-die-sides">CUSTOM DIE</label>
    <div class="custom-die-entry">
      <span id="desktop-custom-die-preview">dX</span>
      <input id="desktop-custom-die-sides" type="text" inputmode="text" maxlength="8" autocomplete="off" autocapitalize="none" spellcheck="false" pattern="[dD]?[0-9]{1,7}" placeholder="d37 or 37" aria-label="Custom die, enter a number such as 37 or d37">
      <button id="desktop-custom-die-roll-btn" class="btn primary" type="button">ROLL dX</button>
    </div>
    <span class="custom-die-note">Enter 3 or d3. Secure random range 1–N, up to d1,000,000.</span>`;
  selector.insertAdjacentElement('afterend', popover);
}

function controls() {
  return [
    {
      toggle: document.getElementById('desktop-custom-die-btn'),
      popover: document.getElementById('desktop-custom-die-popover'),
      input: document.getElementById('desktop-custom-die-sides'),
      roll: document.getElementById('desktop-custom-die-roll-btn'),
      preview: document.getElementById('desktop-custom-die-preview'),
    },
    {
      toggle: document.getElementById('mobile-custom-die-btn'),
      popover: document.getElementById('custom-die-popover'),
      input: document.getElementById('custom-die-sides'),
      roll: document.getElementById('custom-die-roll-btn'),
      preview: document.querySelector('#custom-die-popover .custom-die-entry > span'),
    },
  ].filter(control => control.toggle && control.popover && control.input && control.roll);
}

function setOpen(control, open) {
  control.popover.classList.toggle('hidden', !open);
  control.popover.setAttribute('aria-hidden', String(!open));
  control.toggle.setAttribute('aria-expanded', String(open));
  control.toggle.classList.toggle('active', open);
  if (open) control.input.focus();
}

function updateLabel(control) {
  try {
    const sides = normalizeCustomSides(control.input.value);
    control.input.setCustomValidity('');
    control.roll.textContent = `ROLL d${sides}`;
    if (control.preview) control.preview.textContent = `d${sides}`;
  } catch {
    control.roll.textContent = 'ROLL dX';
    if (control.preview) control.preview.textContent = 'dX';
  }
}

function syncDisabled() {
  controls().forEach(control => {
    control.toggle.disabled = state.rolling;
    control.input.disabled = state.rolling;
    control.roll.disabled = state.rolling;
  });
}

function bindControl(control) {
  control.toggle.textContent = 'CUSTOM';
  control.toggle.addEventListener('click', () => {
    const open = control.toggle.getAttribute('aria-expanded') !== 'true';
    controls().forEach(item => setOpen(item, item === control && open));
  });
  control.input.addEventListener('input', () => {
    control.input.setCustomValidity('');
    updateLabel(control);
  });
  const roll = () => {
    activeControl = control;
    control.input.setCustomValidity('');
    performCustomRoll(control.input.value);
  };
  control.roll.addEventListener('click', roll);
  control.input.addEventListener('keydown', event => {
    if (event.key === 'Enter') roll();
  });
  updateLabel(control);
}

export function closeCustomDieControls() {
  controls().forEach(control => setOpen(control, false));
}

export function initCustomDieControls() {
  try {
    if (initialized) return;
    initialized = true;
    ensureDesktopMarkup();
    controls().forEach(bindControl);
    document.addEventListener('rollstatechange', syncDisabled);
    document.addEventListener('customrollcomplete', closeCustomDieControls);
    document.addEventListener('customrollerror', event => {
      if (!activeControl) return;
      activeControl.input.setCustomValidity(event.detail?.message || 'Custom roll failed.');
      activeControl.input.reportValidity();
    });
    syncDisabled();
  } catch (error) {
    console.error('Failed to initialize custom die controls:', error);
  }
}
