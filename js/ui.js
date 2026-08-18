import { state, activeCustomFaces, savePreferences } from './state.js';
import { playDiceSound, playNat20Fanfare, playNat1DoomSound } from './audio.js';
import { TRAY_THEMES, DIE_SKINS, getDieSides, rollDie } from './utils.js';

export function initStylePicker() {
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

export function renderHistory() {
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

export function calculateTotal(isRolling = false) {
  const totalResultElem = document.getElementById('total-result');
  const breakdownElem = document.getElementById('breakdown-text');

  try {
    let diceTotal = 0;
    let breakdownArr = [];

    state.selectedDice.forEach(die => {
      if (die.rolled && !die.isDropped) {
        diceTotal += die.value;
        breakdownArr.push(activeCustomFaces[die.value] || die.value);
      }
    });

    const finalTotal = state.hasRolled ? diceTotal : 0;

    if (totalResultElem) {
      if (isRolling) {
        totalResultElem.textContent = '🎲...';
      } else {
        totalResultElem.textContent = activeCustomFaces[finalTotal] || finalTotal;
      }
    }

    if (breakdownElem) {
      if (!state.hasRolled) {
        breakdownElem.textContent = '';
      } else if (isRolling) {
        breakdownElem.textContent = 'Rolling...';
      } else {
        breakdownElem.textContent = 'Rolls: (' + breakdownArr.join(' + ') + ')';
      }
    }

    return { finalTotal, breakdownStr: breakdownArr.join(', ') };
  } catch (err) {
    console.error("Error calculating total:", err);
    return { finalTotal: 0, breakdownStr: '' };
  }
}

export function updateTrayPreview(isRolling = false) {
  const diceTray = document.getElementById('dice-tray');
  if (!diceTray) return;

  if (state.selectedDice.length === 0) {
    diceTray.replaceChildren();
    const placeholder = document.createElement('div');
    placeholder.className = 'tray-placeholder';
    placeholder.textContent = 'Tap dice above to build your roll!';
    diceTray.appendChild(placeholder);
    calculateTotal(false);
    return;
  }

  diceTray.replaceChildren();
  
  state.selectedDice.forEach((die, index) => {
    try {
      const dieDiv = document.createElement('div');
      const shapeClass = 'shape-' + die.type.toLowerCase();

      dieDiv.className = 'rendered-die ' + shapeClass + ' ' + (die.isDropped ? 'dropped' : '') + (isRolling ? ' rolling' : '');
      dieDiv.setAttribute('role', 'button');
      dieDiv.setAttribute('tabindex', '0');
      
      let finalDisplayVal = die.rolled ? (activeCustomFaces[die.value] || die.value) : '?';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'die-label';
      labelSpan.textContent = die.type.toUpperCase();

      const valSpan = document.createElement('span');
      valSpan.className = 'die-value';
      valSpan.textContent = finalDisplayVal;

      if (isRolling) {
        dieDiv.style.setProperty('--start-x', (Math.random() * 200 - 100) + 'px');
        dieDiv.style.setProperty('--start-y', (Math.random() * -200 - 100) + 'px');
        dieDiv.style.setProperty('--mid-x', (Math.random() * 100 - 50) + 'px');
        dieDiv.style.setProperty('--mid-y', (Math.random() * 50 - 25) + 'px');
        dieDiv.style.setProperty('--bounce-x', (Math.random() * 40 - 20) + 'px');
        dieDiv.style.setProperty('--bounce-y', (Math.random() * 40 - 20) + 'px');
        dieDiv.style.setProperty('--spin-mid', (Math.random() * 720 - 360) + 'deg');
        dieDiv.style.setProperty('--spin-bounce', (Math.random() * 360 - 180) + 'deg');
        dieDiv.style.setProperty('--spin-final', (Math.random() * 60 - 30) + 'deg');

        const sides = getDieSides(die.type);
        const rollDuration = 600 + Math.random() * 500;
        const startTime = Date.now();

        const scrambleInterval = setInterval(() => {
          try {
            if (Date.now() - startTime > rollDuration) {
              clearInterval(scrambleInterval);
              valSpan.textContent = finalDisplayVal;
              dieDiv.classList.remove('rolling'); 
            } else {
              const randomFace = rollDie(sides);
              valSpan.textContent = activeCustomFaces[randomFace] || randomFace;
            }
          } catch (intervalErr) {
             console.error("Scramble loop failed:", intervalErr);
             clearInterval(scrambleInterval);
             valSpan.textContent = finalDisplayVal;
          }
        }, 50);
      }

      dieDiv.appendChild(labelSpan);
      dieDiv.appendChild(valSpan);
      dieDiv.title = 'Tap to remove';

      const removeDie = () => {
        state.selectedDice.splice(index, 1);
        updateTrayPreview();
      };
      dieDiv.onclick = removeDie;
      
      diceTray.appendChild(dieDiv);
    } catch (err) {
      console.error(`Error rendering die at index ${index}:`, err);
    }
  });

  calculateTotal(isRolling);
}

export function triggerNat20Effect() {
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

export function triggerNat1Effect() {
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

export function performRoll() {
  const diceTray = document.getElementById('dice-tray');

  try {
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

    const maxAnimationTime = 1200; 
    setTimeout(() => {
      try {
        const activeD20s = state.selectedDice.filter(die => die.type === 'd20' && !die.isDropped);
        const hasNat20 = activeD20s.some(die => die.value === 20);
        const hasNat1 = activeD20s.some(die => die.value === 1);

        if (hasNat20) triggerNat20Effect();
        else if (hasNat1) triggerNat1Effect();

        const { finalTotal, breakdownStr } = calculateTotal(false);
        
        const diceCounts = {};
        state.selectedDice.forEach(d => {
          if (!d.isDropped) diceCounts[d.type] = (diceCounts[d.type] || 0) + 1;
        });

        let formulaStr = Object.entries(diceCounts).map(([type, count]) => count + type).join(' + ');
        if (isAdvantageMode) formulaStr += ' (' + (state.d20Mode === 'advantage' ? 'Adv' : 'Disadv') + ')';

        state.history.unshift({
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          formula: formulaStr,
          breakdown: '[' + breakdownStr + ']',
          total: activeCustomFaces[finalTotal] || finalTotal
        });

        if (state.history.length > 30) state.history.pop();
        savePreferences();
        renderHistory();

      } catch (err) {
         console.error("Delayed post-roll logic failed:", err);
      }
    }, maxAnimationTime);

  } catch (err) {
    console.error("Roll execution failed:", err);
  }
}

export function addDie(type) {
  if (state.hasRolled && !state.keepDice) {
    state.selectedDice = [];
    state.hasRolled = false;
  } else if (state.hasRolled && state.keepDice) {
    state.selectedDice = state.selectedDice.filter(d => !d.isDropped);
  }

  state.selectedDice.push({ type: type, value: 0, rolled: false, isDropped: false });
  updateTrayPreview();
}