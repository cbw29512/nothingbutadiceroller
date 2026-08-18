// State Management
const state = {
  selectedDice: [],
  d20Mode: 'normal',
  keepDice: false,
  hasRolled: false,
  soundEnabled: true,
  trayTheme: 'tray-green_felt',
  dieSkin: 'skin-ruby_red',
  history: []
};

const TRAY_THEMES = [
  { id: 'tray-green_felt', name: 'Green Felt' },
  { id: 'tray-red_velvet', name: 'Red Velvet' },
  { id: 'tray-midnight_leather', name: 'Midnight Leather' },
  { id: 'tray-dark_mahogany', name: 'Dark Mahogany' },
  { id: 'tray-dungeon_stone', name: 'Dungeon Stone' },
  { id: 'tray-mystic_obsidian', name: 'Mystic Obsidian' },
  { id: 'tray-neon_cyberpunk', name: 'Neon Cyberpunk' },
  { id: 'tray-synthwave', name: 'Synthwave Grid' }
];

const DIE_SKINS = [
  { id: 'skin-ruby_red', name: 'Ruby Red' },
  { id: 'skin-sapphire_blue', name: 'Sapphire Blue' },
  { id: 'skin-emerald_green', name: 'Emerald Green' },
  { id: 'skin-amethyst_purple', name: 'Amethyst Purple' },
  { id: 'skin-marble_white', name: 'Marble White' },
  { id: 'skin-obsidian_crackle', name: 'Obsidian' },
  { id: 'skin-gold_leaf', name: 'Gold Leaf' },
  { id: 'skin-neon_cyan', name: 'Neon Cyan' }
];

function playDiceSound() {
  if (!state.soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const count = Math.min(Math.max(state.selectedDice.length, 2), 6);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120 + Math.random() * 200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }, i * 60);
    }
  } catch (err) {
    console.log('Audio Context error deferred:', err);
  }
}

function getDieSides(type) {
  return parseInt(type.replace('d', ''), 10);
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function loadPreferences() {
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

function savePreferences() {
  localStorage.setItem('trayTheme', state.trayTheme);
  localStorage.setItem('dieSkin', state.dieSkin);
  localStorage.setItem('rollHistory', JSON.stringify(state.history));
  document.body.className = state.trayTheme + ' ' + state.dieSkin;
}

function initStylePicker() {
  const trayGrid = document.getElementById('tray-themes-grid');
  const skinGrid = document.getElementById('die-skins-grid');

  if (!trayGrid || !skinGrid) return;

  trayGrid.innerHTML = TRAY_THEMES.map(theme => 
    '<button class="swatch-btn ' + (state.trayTheme === theme.id ? 'active' : '') + '" data-theme="' + theme.id + '">' + theme.name + '</button>'
  ).join('');

  skinGrid.innerHTML = DIE_SKINS.map(skin => 
    '<button class="swatch-btn ' + (state.dieSkin === skin.id ? 'active' : '') + '" data-skin="' + skin.id + '">' + skin.name + '</button>'
  ).join('');

  trayGrid.querySelectorAll('.swatch-btn').forEach(btn => {
    btn.onclick = (e) => {
      state.trayTheme = e.target.dataset.theme;
      savePreferences();
      initStylePicker();
    };
  });

  skinGrid.querySelectorAll('.swatch-btn').forEach(btn => {
    btn.onclick = (e) => {
      state.dieSkin = e.target.dataset.skin;
      savePreferences();
      initStylePicker();
    };
  });
}

function renderHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  if (state.history.length === 0) {
    historyList.innerHTML = '<p style="color:#aaa; text-align:center; padding: 1rem 0;">No rolls logged yet.</p>';
    return;
  }

  historyList.innerHTML = state.history.map(item => 
    '<div class="history-item">' +
      '<div class="history-time">' + item.timestamp + '</div>' +
      '<div class="history-formula">' + item.formula + '</div>' +
      '<div class="history-breakdown">' + item.breakdown + '</div>' +
      '<div class="history-total">' + item.total + '</div>' +
    '</div>'
  ).join('');
}

function calculateTotal() {
  const totalResultElem = document.getElementById('total-result');
  const breakdownElem = document.getElementById('breakdown-text');

  let diceTotal = 0;
  let breakdownArr = [];

  state.selectedDice.forEach(die => {
    if (die.rolled && !die.isDropped) {
      diceTotal += die.value;
      breakdownArr.push(die.value);
    }
  });

  const finalTotal = state.hasRolled ? diceTotal : 0;
  if (totalResultElem) totalResultElem.textContent = finalTotal;

  if (breakdownElem) {
    if (!state.hasRolled) {
      breakdownElem.textContent = '';
    } else {
      breakdownElem.textContent = 'Rolls: (' + breakdownArr.join(' + ') + ')';
    }
  }

  return { finalTotal, breakdownStr: breakdownArr.join(', ') };
}

function updateTrayPreview(isRolling = false) {
  const diceTray = document.getElementById('dice-tray');
  if (!diceTray) return;

  if (state.selectedDice.length === 0) {
    diceTray.innerHTML = '<div class="tray-placeholder">Tap dice above to build your roll!</div>';
    calculateTotal();
    return;
  }

  diceTray.innerHTML = '';
  state.selectedDice.forEach((die, index) => {
    const dieDiv = document.createElement('div');
    const shapeClass = 'shape-' + die.type.toLowerCase();
    
    dieDiv.className = 'rendered-die ' + shapeClass + ' ' + (die.isDropped ? 'dropped' : '') + (isRolling ? ' rolling' : '');
    if (!die.rolled) dieDiv.style.opacity = '0.7';

    const displayVal = die.rolled ? die.value : '?';
    dieDiv.innerHTML = '<span class="die-label">' + die.type.toUpperCase() + '</span><span class="die-value">' + displayVal + '</span>';
    dieDiv.title = 'Tap to remove';
    dieDiv.onclick = () => {
      state.selectedDice.splice(index, 1);
      updateTrayPreview();
    };
    diceTray.appendChild(dieDiv);
  });

  calculateTotal();
}

function performRoll() {
  const diceTray = document.getElementById('dice-tray');
  
  // If tray is empty in Adv/Disadv mode, auto-add a single base d20
  if (state.selectedDice.length === 0 && state.d20Mode !== 'normal') {
    state.selectedDice.push({ type: 'd20', value: 0, rolled: false, isDropped: false });
  }

  if (state.selectedDice.length === 0 || !diceTray) return;

  playDiceSound();

  // Remove old dropped dice from previous rolls
  let baseDice = state.selectedDice.filter(d => !d.isDropped);

  let newDiceList = [];
  const isAdvantageMode = state.d20Mode !== 'normal';

  baseDice.forEach((die) => {
    const sides = getDieSides(die.type);

    // Apply Advantage/Disadvantage exclusively to d20 dice
    if (die.type === 'd20' && isAdvantageMode) {
      const val1 = rollDie(20);
      const val2 = rollDie(20);

      let keptVal, droppedVal;
      if (state.d20Mode === 'advantage') {
        keptVal = Math.max(val1, val2);
        droppedVal = Math.min(val1, val2);
      } else {
        keptVal = Math.min(val1, val2);
        droppedVal = Math.max(val1, val2);
      }

      newDiceList.push({ type: 'd20', value: keptVal, rolled: true, isDropped: false });
      newDiceList.push({ type: 'd20', value: droppedVal, rolled: true, isDropped: true });
      return;
    }

    // Standard roll for non-d20s or normal d20 mode
    const val = rollDie(sides);
    newDiceList.push({ type: die.type, value: val, rolled: true, isDropped: false });
  });

  state.selectedDice = newDiceList;
  state.hasRolled = true;
  updateTrayPreview(true);

  const { finalTotal, breakdownStr } = calculateTotal();
  const diceCounts = {};
  state.selectedDice.forEach(d => {
    if (!d.isDropped) diceCounts[d.type] = (diceCounts[d.type] || 0) + 1;
  });

  let formulaStr = Object.entries(diceCounts).map(([type, count]) => count + type).join(' + ');
  if (isAdvantageMode) {
    formulaStr += ' (' + (state.d20Mode === 'advantage' ? 'Adv' : 'Disadv') + ')';
  }

  state.history.unshift({
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    formula: formulaStr,
    breakdown: '[' + breakdownStr + ']',
    total: finalTotal
  });

  if (state.history.length > 30) state.history.pop();
  savePreferences();
  renderHistory();
}

function addDie(type) {
  if (state.hasRolled && !state.keepDice) {
    state.selectedDice = [];
    state.hasRolled = false;
  } else if (state.hasRolled && state.keepDice) {
    state.selectedDice = state.selectedDice.filter(d => !d.isDropped);
  }

  state.selectedDice.push({ type: type, value: 0, rolled: false, isDropped: false });
  updateTrayPreview();
}

function bindEvents() {
  loadPreferences();
  initStylePicker();
  renderHistory();

  document.querySelectorAll('.die-btn').forEach(btn => {
    btn.onclick = () => {
      const type = btn.getAttribute('data-type');
      if (type) addDie(type);
    };
  });

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

  const keepBtn = document.getElementById('keep-btn');
  if (keepBtn) {
    keepBtn.onclick = () => {
      state.keepDice = !state.keepDice;
      keepBtn.classList.toggle('active', state.keepDice);
    };
  }

  const soundBtn = document.getElementById('sound-toggle-btn');
  if (soundBtn) {
    soundBtn.onclick = () => {
      state.soundEnabled = !state.soundEnabled;
      soundBtn.textContent = '🔊 ' + (state.soundEnabled ? 'ON' : 'OFF');
    };
  }

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

  const stylesDrawer = document.getElementById('styles-drawer');
  const historyDrawer = document.getElementById('history-drawer');

  const openStylesBtn = document.getElementById('open-styles-btn');
  if (openStylesBtn) openStylesBtn.onclick = () => stylesDrawer.classList.remove('hidden');

  const closeStylesBtn = document.getElementById('close-styles-btn');
  if (closeStylesBtn) closeStylesBtn.onclick = () => stylesDrawer.classList.add('hidden');

  const openHistoryBtn = document.getElementById('open-history-btn');
  if (openHistoryBtn) openHistoryBtn.onclick = () => historyDrawer.classList.remove('hidden');

  const closeHistoryBtn = document.getElementById('close-history-btn');
  if (closeHistoryBtn) closeHistoryBtn.onclick = () => historyDrawer.classList.add('hidden');

  document.querySelectorAll('.drawer-backdrop').forEach(backdrop => {
    backdrop.onclick = () => {
      stylesDrawer.classList.add('hidden');
      historyDrawer.classList.add('hidden');
    };
  });

  const clearHistoryBtn = document.getElementById('clear-history-btn');
  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      state.history = [];
      savePreferences();
      renderHistory();
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindEvents);
} else {
  bindEvents();
}
