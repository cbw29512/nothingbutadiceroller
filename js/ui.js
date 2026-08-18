import { state, savePreferences } from './state.js';
import { TRAY_THEMES, DIE_SKINS, countDice } from './utils.js';

export function renderPool() {
  try {
    const chips = document.getElementById('pool-chips');
    const summary = document.getElementById('pool-summary');
    const emptyState = document.getElementById('tray-empty-state');
    if (!chips || !summary) return;

    chips.replaceChildren();
    const counts = countDice(state.selectedDice);
    const entries = Object.entries(counts);
    summary.textContent = entries.length
      ? entries.map(([type, count]) => `${count}${type}`).join(' + ')
      : 'No dice selected';

    entries.forEach(([type, count]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pool-chip';
      chip.textContent = `${count}${type} ×`;
      chip.title = `Remove one ${type}`;
      chip.onclick = () => {
        const index = state.selectedDice.findLastIndex(die => die.type === type);
        if (index >= 0) state.selectedDice.splice(index, 1);
        renderPool();
      };
      chips.appendChild(chip);
    });

    emptyState?.classList.toggle('hidden', state.selectedDice.length > 0 || state.hasRolled);
  } catch (err) {
    console.error('Failed to render dice pool:', err);
  }
}

export function renderHistory() {
  try {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.replaceChildren();

    if (state.history.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No rolls logged yet.';
      empty.className = 'status-line';
      list.appendChild(empty);
      return;
    }

    state.history.forEach(item => {
      const row = document.createElement('div');
      row.className = 'history-item';
      ['formula', 'time', 'breakdown', 'total'].forEach(key => {
        const cell = document.createElement('div');
        cell.className = `history-${key}`;
        cell.textContent = item[key];
        row.appendChild(cell);
      });
      list.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to render roll history:', err);
  }
}

export function renderResults(total = 0, breakdown = 'No active roll') {
  try {
    const totalEl = document.getElementById('total-result');
    const breakdownEl = document.getElementById('breakdown-text');
    if (totalEl) totalEl.textContent = String(total);
    if (breakdownEl) breakdownEl.textContent = breakdown;
  } catch (err) {
    console.error('Failed to render roll results:', err);
  }
}

export function setStatus(message, kind = '') {
  try {
    const status = document.getElementById('physics-status');
    if (!status) return;
    status.textContent = message;
    status.className = `status-line ${kind}`.trim();
  } catch (err) {
    console.error('Failed to update application status:', err);
  }
}

export function showCrit(kind) {
  try {
    const host = document.getElementById('tray-effects');
    if (!host) return;
    host.replaceChildren();

    const banner = document.createElement('div');
    banner.className = `crit-banner ${kind}`;
    banner.textContent = kind === 'nat20' ? '🎉 NATURAL 20! 🎉' : '💀 CRITICAL FAIL! 💀';
    host.appendChild(banner);
    setTimeout(() => host.replaceChildren(), 1700);
  } catch (err) {
    console.error('Failed to render critical-roll effect:', err);
  }
}

export function initStylePicker(onSkinChange) {
  try {
    const trayGrid = document.getElementById('tray-themes-grid');
    const skinGrid = document.getElementById('die-skins-grid');
    if (!trayGrid || !skinGrid) return;

    trayGrid.replaceChildren();
    TRAY_THEMES.forEach(theme => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `swatch-btn ${state.trayTheme === theme.id ? 'active' : ''}`.trim();
      button.textContent = theme.name;
      button.onclick = () => {
        state.trayTheme = theme.id;
        savePreferences();
        initStylePicker(onSkinChange);
      };
      trayGrid.appendChild(button);
    });

    skinGrid.replaceChildren();
    DIE_SKINS.forEach(skin => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `swatch-btn ${state.dieSkin === skin.id ? 'active' : ''}`.trim();
      button.textContent = skin.name;
      button.onclick = async () => {
        state.dieSkin = skin.id;
        savePreferences();
        initStylePicker(onSkinChange);
        try { await onSkinChange?.(); } catch (err) { console.error('Dice skin update failed:', err); }
      };
      skinGrid.appendChild(button);
    });
  } catch (err) {
    console.error('Failed to initialize style picker:', err);
  }
}
