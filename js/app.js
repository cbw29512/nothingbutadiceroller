// State Management Imports
import { state, loadPreferences, savePreferences } from './state.js';

// UI & Logic Controller Imports
import { 
  initStylePicker, 
  renderHistory, 
  updateTrayPreview, 
  performRoll, 
  addDie 
} from './ui.js';

/**
 * Binds DOM event listeners and initializes module states.
 */
function bindEvents() {
  try {
    // 1. Initial State & UI Hydration
    loadPreferences();
    initStylePicker();
    renderHistory();
    updateTrayPreview();

    // 2. Die Add Buttons
    document.querySelectorAll('.die-btn').forEach(btn => {
      btn.onclick = () => {
        const type = btn.getAttribute('data-type');
        if (type) addDie(type);
      };
    });

    // 3. Advantage / Disadvantage Mode Toggles
    document.querySelectorAll('.adv-btn').forEach(btn => {
      btn.onclick = (e) => {
        const target = e.currentTarget;
        if (target.id === 'keep-btn') return;

        document.querySelectorAll('.adv-btn').forEach(b => {
          if (b.id !== 'keep-btn') b.classList.remove('active');
        });
        
        target.classList.add('active');
        state.d20Mode = target.getAttribute('data-adv');
      };
    });

    // 4. Keep Pool Toggle
    const keepBtn = document.getElementById('keep-btn');
    if (keepBtn) {
      keepBtn.onclick = () => {
        state.keepDice = !state.keepDice;
        keepBtn.classList.toggle('active', state.keepDice);
      };
    }

    // 5. Sound Toggle
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.onclick = () => {
        state.soundEnabled = !state.soundEnabled;
        soundBtn.textContent = '🔊 ' + (state.soundEnabled ? 'ON' : 'OFF');
      };
    }

    // 6. Roll & Clear Actions
    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) rollBtn.onclick = performRoll;

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        state.selectedDice = [];
        state.hasRolled = false;
        updateTrayPreview();
      };
    }

    // 7. Drawer Navigation Controls
    const stylesDrawer = document.getElementById('styles-drawer');
    const historyDrawer = document.getElementById('history-drawer');

    const openStylesBtn = document.getElementById('open-styles-btn');
    if (openStylesBtn) openStylesBtn.onclick = () => stylesDrawer?.classList.remove('hidden');

    const closeStylesBtn = document.getElementById('close-styles-btn');
    if (closeStylesBtn) closeStylesBtn.onclick = () => stylesDrawer?.classList.add('hidden');

    const openHistoryBtn = document.getElementById('open-history-btn');
    if (openHistoryBtn) openHistoryBtn.onclick = () => historyDrawer?.classList.remove('hidden');

    const closeHistoryBtn = document.getElementById('close-history-btn');
    if (closeHistoryBtn) closeHistoryBtn.onclick = () => historyDrawer?.classList.add('hidden');

    document.querySelectorAll('.drawer-backdrop').forEach(backdrop => {
      backdrop.onclick = () => {
        stylesDrawer?.classList.add('hidden');
        historyDrawer?.classList.add('hidden');
      };
    });

    // 8. History Reset Action
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.onclick = () => {
        state.history = [];
        savePreferences(); // Imported from ./state.js
        renderHistory();
      };
    }
  } catch (err) {
    console.error('Failed to initialize application bindings:', err);
  }
}

// Execution Entrypoint
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindEvents);
} else {
  bindEvents();
}