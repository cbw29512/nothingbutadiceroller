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
  { id: 'tray-synthwave', name: 'Synthwave Grid' },
  { id: 'tray-arcane_sanctum', name: 'Arcane Sanctum' },
  { id: 'tray-celestial_void', name: 'Celestial Void' },
  { id: 'tray-lava_pit', name: 'Lava Pit' },
  { id: 'tray-royal_gold', name: 'Royal Gold' }
];

const DIE_SKINS = [
  { id: 'skin-ruby_red', name: 'Ruby Red' },
  { id: 'skin-sapphire_blue', name: 'Sapphire Blue' },
  { id: 'skin-emerald_green', name: 'Emerald Green' },
  { id: 'skin-amethyst_purple', name: 'Amethyst Purple' },
  { id: 'skin-marble_white', name: 'Marble White' },
  { id: 'skin-obsidian_crackle', name: 'Obsidian' },
  { id: 'skin-gold_leaf', name: 'Gold Leaf' },
  { id: 'skin-neon_cyan', name: 'Neon Cyan' },
  { id: 'skin-cosmic_nebula', name: 'Cosmic Nebula' },
  { id: 'skin-dragon_scale', name: 'Dragon Scale' },
  { id: 'skin-frostbite', name: 'Frostbite' },
  { id: 'skin-blood_moon', name: 'Blood Moon' }
];

// Standard Rolling Sound
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

// Nat 20 Fanfare Synthesizer
function playNat20Fanfare() {
  if (!state.soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, index) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }, index * 90);
    });
  } catch (err) {
    console.log('Audio Context error deferred:', err);
  }
}

// Nat 1 Doom Sound Synthesizer
function playNat1DoomSound() {
  if (!state.soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const notes = [146.83, 116.54, 87.31];
    notes.forEach((freq, index) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }, index * 120);
    });
  } catch (err) {
    console.log('Audio Context error deferred:', err);
  }
}

function triggerNat20Effect() {
  const diceTray = document.getElementById('dice-tray');
  if (!diceTray) return;

  const existing = diceTray.querySelector('.nat20-banner, .nat1-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'nat20-banner';
  banner.textContent = '🎉 NATURAL 20! 🎉';
  diceTray.appendChild(banner);

  playNat20Fanfare();

  setTimeout(() => {
    if (banner.parentNode) banner.remove();
  }, 1800);
}

function triggerNat1Effect() {
  const diceTray = document.getElementById('dice-tray');
  if (!diceTray) return;

  const existing = diceTray.querySelector('.nat20-banner, .nat1-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'nat1-banner';
  banner.textContent = '💀 CRITICAL FAIL! 💀';
  diceTray.appendChild(banner);

  diceTray.classList.add('doom-shake');
  playNat1DoomSound();

  setTimeout(() => {
    diceTray.classList.remove('doom-shake');
    if (banner.parentNode) banner.remove();
  }, 1800);
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

  trayGrid.replaceChildren();
  TRAY_THEMES.forEach(theme => {
    const btn = document.createElement('button');
    btn.className = 'swatch-btn ' + (state.trayTheme === theme.id ? 'active' : '');
    btn.dataset.theme = theme.id;
    btn.textContent = theme.name;
    btn.onclick = (e) => {
      state.trayTheme = e.target.dataset.theme;
      savePreferences();
      initStylePicker();
    };
    trayGrid.appendChild(btn);
  });

  skinGrid.replaceChildren();
  DIE_SKINS.forEach(skin => {
    const btn = document.createElement('button');
    btn.className = 'swatch-btn ' + (state.dieSkin === skin.id ? 'active' : '');
    btn.dataset.skin = skin.id;
    btn.textContent = skin.name;
    btn.onclick = (e) => {
      state.dieSkin = e.target.dataset.skin;
      savePreferences();
      initStylePicker();
    };
    skinGrid.appendChild(btn);
  });
}

function renderHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  historyList.replaceChildren();

  if (state.history.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = 'color:#d1d5db; text-align:center; padding: 1rem 0;';
    emptyMsg.textContent = 'No rolls logged yet.';
    historyList.appendChild(emptyMsg);
    return;
  }

  state.history.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'history-time';
    timeDiv.textContent = item.timestamp;

    const formulaDiv = document.createElement('div');
    formulaDiv.className = 'history-formula';
    formulaDiv.textContent = item.formula;

    const breakdownDiv = document.createElement('div');
    breakdownDiv.className = 'history-breakdown';
    breakdownDiv.textContent = item.breakdown;

    const totalDiv = document.createElement('div');
    totalDiv.className = 'history-total';
    totalDiv.textContent = item.total;

    itemDiv.appendChild(timeDiv);
    itemDiv.appendChild(formulaDiv);
    itemDiv.appendChild(breakdownDiv);
    itemDiv.appendChild(totalDiv);

    historyList.appendChild(itemDiv);
  });
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
    diceTray.replaceChildren();
    const placeholder = document.createElement('div');
    placeholder.className = 'tray-placeholder';
    placeholder.textContent = 'Tap dice above to build your roll!';
    diceTray.appendChild(placeholder);
    calculateTotal();
    return;
  }

  diceTray.replaceChildren();
  state.selectedDice.forEach((die, index) => {
    const dieDiv = document.createElement('div');
    const shapeClass = 'shape-' + die.type.toLowerCase();

    dieDiv.className = 'rendered-die ' + shapeClass + ' ' + (die.isDropped ? 'dropped' : '') + (isRolling ? ' rolling' : '');
    dieDiv.setAttribute('role', 'button');
    dieDiv.setAttribute('tabindex', '0');
    dieDiv.setAttribute('aria-label', `Remove ${die.type.toUpperCase()} from tray`);

    if (isRolling) {
      const startX = (Math.random() * 160 - 80) + 'px';
      const startY = (Math.random() * -120 - 40) + 'px';
      const midX = (Math.random() * 80 - 40) + 'px';
      const midY = (Math.random() * 40 - 20) + 'px';
      const bounceX = (Math.random() * 30 - 15) + 'px';
      const bounceY = (Math.random() * 30 - 15) + 'px';
      const spinMid = (Math.random() > 0.5 ? 360 : -360) + 'deg';
      const spinBounce = (Math.random() > 0.5 ? 720 : -720) + 'deg';
      const spinFinal = (Math.random() * 40 - 20) + 'deg';

      dieDiv.style.setProperty('--start-x', startX);
      dieDiv.style.setProperty('--start-y', startY);
      dieDiv.style.setProperty('--mid-x', midX);
      dieDiv.style.setProperty('--mid-y', midY);
      dieDiv.style.setProperty('--bounce-x', bounceX);
      dieDiv.style.setProperty('--bounce-y', bounceY);
      dieDiv.style.setProperty('--spin-mid', spinMid);
      dieDiv.style.setProperty('--spin-bounce', spinBounce);
      dieDiv.style.setProperty('--spin-final', spinFinal);
    }

    if (!die.rolled) dieDiv.style.opacity = '0.7';

    const displayVal = die.rolled ? die.value : '?';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'die-label';
    labelSpan.textContent = die.type.toUpperCase();

    const valSpan = document.createElement('span');
    valSpan.className = 'die-value';
    valSpan.textContent = displayVal;

    dieDiv.appendChild(labelSpan);
    dieDiv.appendChild(valSpan);
    dieDiv.title = 'Tap to remove';

    const removeDie = () => {
      state.selectedDice.splice(index, 1);
      updateTrayPreview();
    };

    dieDiv.onclick = removeDie;
    dieDiv.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        removeDie();
      }
    };

    diceTray.appendChild(dieDiv);
  });

  calculateTotal();
}

function performRoll() {
  const diceTray = document.getElementById('dice-tray');

  if (state.selectedDice.length === 0 && state.d20Mode !== 'normal') {
    state.selectedDice.push({ type: 'd20', value: 0, rolled: false, isDropped: false });
  }

  if (state.selectedDice.length === 0 || !diceTray) return;

  playDiceSound();

  let baseDice = state.selectedDice.filter(d => !d.isDropped);
  let newDiceList = [];
  const isAdvantageMode = state.d20Mode !== 'normal';

  baseDice.forEach((die) => {
    const sides = getDieSides(die.type);

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

    const val = rollDie(sides);
    newDiceList.push({ type: die.type, value: val, rolled: true, isDropped: false });
  });

  state.selectedDice = newDiceList;
  state.hasRolled = true;
  updateTrayPreview(true);

  // Nat 20 and Nat 1 Trigger Check
  const activeD20s = state.selectedDice.filter(die => die.type === 'd20' && !die.isDropped);
  const hasNat20 = activeD20s.some(die => die.value === 20);
  const hasNat1 = activeD20s.some(die => die.value === 1);

  setTimeout(() => {
    if (hasNat20) {
      triggerNat20Effect();
    } else if (hasNat1) {
      triggerNat1Effect();
    }
  }, 650);

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