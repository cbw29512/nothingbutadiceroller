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

export function ensureNormalD20Buttons() {
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
