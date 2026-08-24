import { state } from './state.js';
import { canRerollHistoryItem } from './history-records.mjs';
import { countDice } from './utils.js';

export function formatRollButtonLabel(selectedDice = state.selectedDice) {
  try {
    const dice = Array.isArray(selectedDice) ? selectedDice : [];
    const entries = Object.entries(countDice(dice));
    if (!entries.length) return 'Roll Dice';

    const formula = entries
      .map(([type, count]) => `${count === 1 ? '' : count}${type}`)
      .join(' + ');
    return `Roll ${formula}`;
  } catch (err) {
    console.error('Failed to format roll button label:', err);
    return 'Roll Dice';
  }
}

export function formatNaturalRollFeedback(kind) {
  if (kind === 'nat20') return '🎉 NATURAL 20! 🎉';
  if (kind === 'nat1') return '💀 NATURAL 1! 💀';
  return '';
}

function syncRollButtonLabels() {
  const label = formatRollButtonLabel(state.selectedDice);
  ['roll-btn', 'mobile-roll-btn'].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.textContent = label;
    button.setAttribute('aria-label', label);
    button.title = label;
  });
}

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
    syncRollButtonLabels();

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
        document.dispatchEvent(new Event('rollstatechange'));
      };
      chips.appendChild(chip);
    });

    if (emptyState && state.selectedDice.length === 0 && !state.hasRolled) {
      emptyState.textContent = 'Choose dice, then roll.';
    }
    emptyState?.classList.toggle('hidden', state.selectedDice.length > 0 || state.hasRolled);
  } catch (err) {
    console.error('Failed to render dice pool:', err);
  }
}

export function renderHistory() {
  try {
    const list = document.getElementById('history-list');
    const historyBtn = document.getElementById('open-history-btn');
    if (historyBtn) historyBtn.textContent = `History${state.history.length ? ` (${state.history.length})` : ''}`;
    if (!list) return;
    list.replaceChildren();

    if (state.history.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No rolls logged yet.';
      empty.className = 'status-line';
      list.appendChild(empty);
      return;
    }

    state.history.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'history-item';
      ['formula', 'time', 'breakdown', 'total'].forEach(key => {
        const cell = document.createElement('div');
        cell.className = `history-${key}`;
        cell.textContent = item[key];
        row.appendChild(cell);
      });

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const reroll = document.createElement('button');
      reroll.type = 'button';
      reroll.className = 'btn ghost history-action-btn history-reroll-btn';
      reroll.dataset.historyAction = 'reroll';
      reroll.dataset.historyIndex = String(index);
      reroll.textContent = 'Reroll';
      reroll.disabled = !canRerollHistoryItem(item);
      reroll.title = reroll.disabled
        ? 'Exact reroll is unavailable for this older or non-replayable history entry.'
        : `Reroll ${item.formula}`;

      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn ghost history-action-btn history-copy-btn';
      copy.dataset.historyAction = 'copy';
      copy.dataset.historyIndex = String(index);
      copy.textContent = 'Copy';
      copy.title = `Copy ${item.formula}`;

      actions.append(reroll, copy);
      row.appendChild(actions);
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

    const message = formatNaturalRollFeedback(kind);
    if (!message) return;

    const banner = document.createElement('div');
    banner.className = `crit-banner ${kind}`;
    banner.textContent = message;
    host.appendChild(banner);
    setTimeout(() => host.replaceChildren(), 1700);
  } catch (err) {
    console.error('Failed to render natural-roll effect:', err);
  }
}
