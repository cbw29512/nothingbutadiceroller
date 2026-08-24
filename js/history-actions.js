import { state } from './state.js';
import { formatHistoryItemForCopy, normalizeHistoryReroll } from './history-records.mjs';

async function defaultWriteText(text, { documentRef = document, navigatorRef = navigator } = {}) {
  if (navigatorRef?.clipboard?.writeText) {
    await navigatorRef.clipboard.writeText(text);
    return true;
  }

  const area = documentRef.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  documentRef.body.appendChild(area);
  area.select();
  const copied = documentRef.execCommand?.('copy') === true;
  area.remove();
  if (!copied) throw new Error('Clipboard access is unavailable in this browser.');
  return true;
}

export function initHistoryActions({
  documentRef = document,
  navigatorRef = navigator,
  reroll,
  setStatus,
  writeText = (text) => defaultWriteText(text, { documentRef, navigatorRef }),
} = {}) {
  try {
    const list = documentRef.getElementById('history-list');
    if (!list || list.dataset.historyActionsBound === 'true') return null;
    list.dataset.historyActionsBound = 'true';

    const onClick = async (event) => {
      const button = event.target.closest('[data-history-action]');
      if (!button || button.disabled || !list.contains(button)) return;
      const index = Number(button.dataset.historyIndex);
      const item = Number.isInteger(index) ? state.history[index] : null;
      if (!item) {
        setStatus?.('That history entry is no longer available.', 'error');
        return;
      }

      const action = button.dataset.historyAction;
      if (action === 'copy') {
        try {
          await writeText(formatHistoryItemForCopy(item));
          setStatus?.('History roll copied.', 'ready');
        } catch (error) {
          console.error('Failed to copy history roll:', error);
          setStatus?.(error.message || 'Unable to copy this history roll.', 'error');
        }
        return;
      }

      if (action === 'reroll') {
        const descriptor = normalizeHistoryReroll(item.reroll);
        if (!descriptor) {
          setStatus?.('Exact reroll is unavailable for this older history entry.', 'error');
          return;
        }
        try {
          button.disabled = true;
          await reroll?.(descriptor, item);
        } catch (error) {
          console.error('Failed to reroll history entry:', error);
          setStatus?.(error.message || 'Unable to reroll this history entry.', 'error');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      }
    };

    list.addEventListener('click', onClick);
    return { destroy: () => list.removeEventListener('click', onClick) };
  } catch (error) {
    console.error('Failed to initialize history actions:', error);
    return null;
  }
}
