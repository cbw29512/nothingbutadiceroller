document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let dicePool = []; 
    let advMode = 'normal'; 
    let rollHistory = JSON.parse(localStorage.getItem('dice_history')) || [];
    let currentSkin = localStorage.getItem('dice_skin') || 'ruby_red';
    let currentTray = localStorage.getItem('tray_theme') || 'green_felt';

    // --- DOM ELEMENTS ---
    const diceTray = document.getElementById('diceTray');
    const totalNumber = document.getElementById('totalNumber');
    const breakdownText = document.getElementById('breakdownText');
    const rollBtn = document.getElementById('rollBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    const historyDrawer = document.getElementById('historyDrawer');
    const themeDrawer = document.getElementById('themeDrawer');
    const historyList = document.getElementById('historyList');

    // --- INITIALIZATION ---
    document.body.className = `skin-${currentSkin} tray-${currentTray}`;
    updateTrayPlaceholder();
    renderHistory();

    // --- DICE SELECTION LISTENERS ---
    document.querySelectorAll('.die-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dieType = btn.getAttribute('data-die');
            dicePool.push(dieType);
            updatePoolDisplay();
        });
    });

    // --- ADVANTAGE TOGGLE LISTENERS ---
    document.querySelectorAll('.adv-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.adv-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            advMode = btn.getAttribute('data-adv');
        });
    });

    // --- ACTION BUTTONS ---
    rollBtn.addEventListener('click', executeRoll);
    clearBtn.addEventListener('click', () => {
        dicePool = [];
        diceTray.innerHTML = '<div class="tray-placeholder">Select your dice above and hit Roll!</div>';
        totalNumber.textContent = '0';
        breakdownText.textContent = 'No active roll';
    });

    // --- DRAWER CONTROLS ---
    window.openHistory = () => historyDrawer.classList.remove('hidden');
    window.closeHistory = () => historyDrawer.classList.add('hidden');
    window.openThemes = () => themeDrawer.classList.remove('hidden');
    window.closeThemes = () => themeDrawer.classList.add('hidden');

    window.setSkin = (skinName) => {
        document.body.className = document.body.className.replace(/skin-\S+/g, `skin-${skinName}`);
        currentSkin = skinName;
        localStorage.setItem('dice_skin', skinName);
    };

    window.setTray = (trayName) => {
        document.body.className = document.body.className.replace(/tray-\S+/g, `tray-${trayName}`);
        currentTray = trayName;
        localStorage.setItem('tray_theme', trayName);
    };

    function updatePoolDisplay() {
        if (dicePool.length === 0) {
            breakdownText.textContent = 'No dice selected';
            return;
        }
        const counts = dicePool.reduce((acc, die) => {
            acc[die] = (acc[die] || 0) + 1;
            return acc;
        }, {});

        const summary = Object.entries(counts)
            .map(([die, count]) => `${count}${die}`)
            .join(' + ');
        
        breakdownText.textContent = `Queued: ${summary} (${advMode.toUpperCase()})`;
    }

    function updateTrayPlaceholder() {
        if (!diceTray.querySelector('.rendered-die')) {
            diceTray.innerHTML = '<div class="tray-placeholder">Select your dice above and hit Roll!</div>';
        }
    }

    // Secure Random Roll Helper
    function rollDie(sides) {
        try {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return (array[0] % sides) + 1;
        } catch (e) {
            return Math.floor(Math.random() * sides) + 1;
        }
    }

    // --- CORE ROLL ENGINE ---
    function executeRoll() {
        if (dicePool.length === 0) {
            alert('Please select at least one die to roll!');
            return;
        }

        diceTray.innerHTML = '';
        let totalSum = 0;
        let rollBreakdown = [];
        let hasNat20 = false;
        let hasNat1 = false;

        dicePool.forEach((dieStr, index) => {
            const sides = parseInt(dieStr.substring(1), 10);
            let finalVal = 0;
            let droppedVal = null;

            if (sides === 20 && advMode !== 'normal') {
                const roll1 = rollDie(20);
                const roll2 = rollDie(20);

                if (advMode === 'advantage') {
                    finalVal = Math.max(roll1, roll2);
                    droppedVal = Math.min(roll1, roll2);
                } else {
                    finalVal = Math.min(roll1, roll2);
                    droppedVal = Math.max(roll1, roll2);
                }

                if (finalVal === 20) hasNat20 = true;
                if (finalVal === 1) hasNat1 = true;

                createDieElement(dieStr, finalVal, index * 80);
                createDieElement(dieStr, droppedVal, index * 80 + 40, true);

                totalSum += finalVal;
                rollBreakdown.push(`${dieStr}[${roll1}, ${roll2} -> **${finalVal}**]`);
            } else {
                finalVal = rollDie(sides);
                
                if (sides === 20) {
                    if (finalVal === 20) hasNat20 = true;
                    if (finalVal === 1) hasNat1 = true;
                }

                createDieElement(dieStr, finalVal, index * 80);
                totalSum += finalVal;
                rollBreakdown.push(`${dieStr}(${finalVal})`);
            }
        });

        totalNumber.textContent = totalSum;
        breakdownText.innerHTML = rollBreakdown.join(' + ');

        if (hasNat20) triggerNat20Effect();
        if (hasNat1) triggerNat1Effect();

        saveToHistory({
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            formula: `${dicePool.length} Dice (${advMode.toUpperCase()})`,
            breakdown: rollBreakdown.join(' + '),
            total: totalSum
        });
    }

    function createDieElement(dieType, value, delayMs, isDropped = false) {
        const dieEl = document.createElement('div');
        dieEl.className = `rendered-die shape-${dieType} rolling`;
        if (isDropped) dieEl.classList.add('dropped');

        const startX = (Math.random() - 0.5) * 200;
        const startY = -150 - Math.random() * 100;
        const midX = (Math.random() - 0.5) * 80;
        const midY = (Math.random() - 0.5) * 60;
        const bounceX = (Math.random() - 0.5) * 30;
        const bounceY = (Math.random() - 0.5) * 30;
        
        const spinMid = Math.floor(Math.random() * 360) + 180;
        const spinBounce = spinMid + Math.floor(Math.random() * 360);
        const spinFinal = spinBounce + Math.floor(Math.random() * 360);

        dieEl.style.setProperty('--start-x', `${startX}px`);
        dieEl.style.setProperty('--start-y', `${startY}px`);
        dieEl.style.setProperty('--mid-x', `${midX}px`);
        dieEl.style.setProperty('--mid-y', `${midY}px`);
        dieEl.style.setProperty('--bounce-x', `${bounceX}px`);
        dieEl.style.setProperty('--bounce-y', `${bounceY}px`);
        dieEl.style.setProperty('--spin-mid', `${spinMid}deg`);
        dieEl.style.setProperty('--spin-bounce', `${spinBounce}deg`);
        dieEl.style.setProperty('--spin-final', `${spinFinal}deg`);
        dieEl.style.animationDelay = `${delayMs}ms`;

        dieEl.innerHTML = `
            <span class="die-value">${value}</span>
            <span class="die-label">${dieType.toUpperCase()}</span>
        `;

        diceTray.appendChild(dieEl);
    }

    function triggerNat20Effect() {
        const banner = document.createElement('div');
        banner.className = 'nat20-banner';
        banner.textContent = '✨ Critical Success! Nat 20! ✨';
        diceTray.appendChild(banner);
        setTimeout(() => banner.remove(), 1800);
    }

    function triggerNat1Effect() {
        const banner = document.createElement('div');
        banner.className = 'nat1-banner';
        banner.textContent = '💀 Critical Fail! Nat 1! 💀';
        diceTray.appendChild(banner);

        diceTray.classList.add('doom-shake');
        setTimeout(() => diceTray.classList.remove('doom-shake'), 400);
        setTimeout(() => banner.remove(), 1800);
    }

    function saveToHistory(record) {
        rollHistory.unshift(record);
        if (rollHistory.length > 25) rollHistory.pop();
        localStorage.setItem('dice_history', JSON.stringify(rollHistory));
        renderHistory();
    }

    function renderHistory() {
        if (!historyList) return;
        if (rollHistory.length === 0) {
            historyList.innerHTML = '<div style="color: #71717a; text-align: center; margin-top: 2rem;">No roll history yet.</div>';
            return;
        }

        historyList.innerHTML = rollHistory.map(item => `
            <div class="history-item">
                <div class="history-time">${item.time} — ${item.formula}</div>
                <div class="history-breakdown">${item.breakdown}</div>
                <div class="history-total">Total: ${item.total}</div>
            </div>
        `).join('');
    }
});