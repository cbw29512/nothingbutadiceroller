let selectedDice = [];
let currentAdvantage = 'normal';
let rollHistory = [];
let currentSkin = 'ruby_red';
let currentTray = 'green_felt';

const skinColors = {
    ruby_red: { bg: '#da3633', text: '#ffffff' },
    sapphire_blue: { bg: '#1f6feb', text: '#ffffff' },
    emerald_green: { bg: '#238636', text: '#ffffff' },
    amethyst_purple: { bg: '#8957e5', text: '#ffffff' },
    marble_white: { bg: '#f0f6fc', text: '#161b22' },
    gold_leaf: { bg: '#d4a72c', text: '#161b22' },
    neon_cyan: { bg: '#38d9a9', text: '#161b22' },
    blood_moon: { bg: '#6e0ad6', text: '#ffffff' }
};

const trayBackgrounds = {
    green_felt: '#0d2818',
    red_velvet: '#3b0a0a',
    midnight_leather: '#111318',
    dungeon_stone: '#21262d',
    neon_cyberpunk: '#120726',
    lava_pit: '#2e1005'
};

document.addEventListener('DOMContentLoaded', () => {
    setupDiceSelector();
    setupAdvantageToggle();
    setupActions();
});

function setupDiceSelector() {
    const selector = document.querySelector('.dice-selector');
    selector.addEventListener('click', (e) => {
        const btn = e.target.closest('.die-btn');
        if (!btn) return;

        const die = btn.getAttribute('data-die');

        if (die === 'custom') {
            const input = prompt("Enter number of sides for your custom die (e.g., 7, 33, 150):");
            if (input !== null) {
                const sides = parseInt(input.trim());
                if (!isNaN(sides) && sides > 0) {
                    const customDie = 'd' + sides;
                    selectedDice.push(customDie);

                    // Create a removable custom button in the grid
                    const customBtn = document.createElement('button');
                    customBtn.className = 'die-btn selected custom-added';
                    customBtn.setAttribute('data-die', customDie);
                    customBtn.textContent = customDie;

                    // Allow clicking it again to deselect/remove
                    customBtn.addEventListener('click', () => {
                        selectedDice = selectedDice.filter(d => d !== customDie);
                        customBtn.remove();
                    });

                    selector.insertBefore(customBtn, document.getElementById('customDieBtn'));
                } else {
                    alert('Please enter a valid positive number.');
                }
            }
        } else {
            if (btn.classList.contains('selected')) {
                btn.classList.remove('selected');
                selectedDice = selectedDice.filter(d => d !== die);
            } else {
                btn.classList.add('selected');
                selectedDice.push(die);
            }
        }
    });
}

function setupAdvantageToggle() {
    const advButtons = document.querySelectorAll('.adv-btn');
    advButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            advButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAdvantage = btn.getAttribute('data-adv');

            const d20Btn = document.querySelector('.die-btn[data-die="d20"]');
            if (currentAdvantage !== 'normal') {
                if (!selectedDice.includes('d20')) {
                    selectedDice.push('d20');
                }
                if (d20Btn) d20Btn.classList.add('selected');
            }
        });
    });
}

function setupActions() {
    document.getElementById('rollBtn').addEventListener('click', executeRoll);
    document.getElementById('clearBtn').addEventListener('click', clearTray);
}

function executeRoll() {
    if (currentAdvantage !== 'normal' && !selectedDice.includes('d20')) {
        selectedDice.push('d20');
    }

    if (selectedDice.length === 0) {
        alert('Please select at least one die to roll!');
        return;
    }

    const tray = document.getElementById('diceTray');
    tray.innerHTML = '';

    let totalSum = 0;
    let breakdownParts = [];
    let currentRollRecord = { timestamp: new Date().toLocaleTimeString(), rolls: [], total: 0 };
    const skin = skinColors[currentSkin] || skinColors.ruby_red;

    selectedDice.forEach(die => {
        const sides = parseInt(die.substring(1));

        if (die === 'd20' && currentAdvantage !== 'normal') {
            const roll1 = Math.floor(Math.random() * 20) + 1;
            const roll2 = Math.floor(Math.random() * 20) + 1;
            
            let keptRoll, droppedRoll;
            if (currentAdvantage === 'advantage') {
                keptRoll = Math.max(roll1, roll2);
                droppedRoll = Math.min(roll1, roll2);
            } else {
                keptRoll = Math.min(roll1, roll2);
                droppedRoll = Math.max(roll1, roll2);
            }

            totalSum += keptRoll;
            breakdownParts.push(`d20 (${currentAdvantage}): ${keptRoll} [${roll1}, ${roll2}]`);
            currentRollRecord.rolls.push({ die: 'd20', result: keptRoll, display: `${keptRoll} (${roll1}, ${roll2} ${currentAdvantage === 'advantage' ? 'adv' : 'dis'})` });

            // Render Die 1
            const dieEl1 = document.createElement('div');
            dieEl1.className = 'rolled-die';
            dieEl1.style.backgroundColor = skin.bg;
            dieEl1.style.color = skin.text;
            if (roll1 !== keptRoll && roll1 === droppedRoll) {
                dieEl1.style.opacity = '0.4';
                dieEl1.style.border = '2px dashed currentColor';
            }
            dieEl1.innerHTML = `<span style="font-size:0.6rem;">D20 (${currentAdvantage.toUpperCase()[0]})</span><span style="font-size:1.1rem;">${roll1}</span>`;
            tray.appendChild(dieEl1);

            // Render Die 2
            const dieEl2 = document.createElement('div');
            dieEl2.className = 'rolled-die';
            dieEl2.style.backgroundColor = skin.bg;
            dieEl2.style.color = skin.text;
            if (roll2 !== keptRoll && roll2 === droppedRoll) {
                dieEl2.style.opacity = '0.4';
                dieEl2.style.border = '2px dashed currentColor';
            }
            dieEl2.innerHTML = `<span style="font-size:0.6rem;">D20 (${currentAdvantage.toUpperCase()[0]})</span><span style="font-size:1.1rem;">${roll2}</span>`;
            tray.appendChild(dieEl2);

        } else {
            const rollResult = Math.floor(Math.random() * sides) + 1;
            totalSum += rollResult;
            breakdownParts.push(`${die}: ${rollResult}`);
            currentRollRecord.rolls.push({ die, result: rollResult, display: `${rollResult}` });

            const dieEl = document.createElement('div');
            dieEl.className = 'rolled-die';
            dieEl.style.backgroundColor = skin.bg;
            dieEl.style.color = skin.text;
            dieEl.innerHTML = `<span style="font-size:0.65rem;">${die.toUpperCase()}</span><span style="font-size:1.1rem;">${rollResult}</span>`;
            tray.appendChild(dieEl);
        }
    });

    currentRollRecord.total = totalSum;
    rollHistory.unshift(currentRollRecord);
    updateHistoryUI();

    document.getElementById('totalNumber').textContent = totalSum;
    document.getElementById('breakdownText').textContent = breakdownParts.join(' | ');
}

function clearTray() {
    const tray = document.getElementById('diceTray');
    tray.innerHTML = '<div class="tray-placeholder">Select your dice above and hit Roll!</div>';
    document.getElementById('totalNumber').textContent = '0';
    document.getElementById('breakdownText').textContent = 'No active roll';
    selectedDice = [];
    document.querySelectorAll('.die-btn').forEach(b => b.classList.remove('selected'));
    
    // Remove any dynamic custom buttons from the grid
    document.querySelectorAll('.custom-added').forEach(b => b.remove());

    document.querySelectorAll('.adv-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.adv-btn[data-adv="normal"]').classList.add('active');
    currentAdvantage = 'normal';
}

function openHistory() {
    document.getElementById('historyDrawer').classList.remove('hidden');
}

function closeHistory() {
    document.getElementById('historyDrawer').classList.add('hidden');
}

function openThemes() {
    document.getElementById('themeDrawer').classList.remove('hidden');
}

function closeThemes() {
    document.getElementById('themeDrawer').classList.add('hidden');
}

function setSkin(skinName) {
    currentSkin = skinName;
    closeThemes();
}

function setTray(trayName) {
    currentTray = trayName;
    const tray = document.getElementById('diceTray');
    tray.style.backgroundColor = trayBackgrounds[trayName] || '#0d2818';
    closeThemes();
}

function updateHistoryUI() {
    const list = document.getElementById('historyList');
    if (rollHistory.length === 0) {
        list.innerHTML = '<div style="color: #71717a; text-align: center; margin-top: 2rem;">No roll history yet.</div>';
        return;
    }

    list.innerHTML = rollHistory.map(item => `
        <div class="history-item">
            <div>
                <div style="font-weight: 600; color: #fff;">Total: ${item.total}</div>
                <div style="font-size: 0.8rem; color: #8b949e;">${item.rolls.map(r => `${r.die}: ${r.display}`).join(', ')}</div>
            </div>
            <div style="font-size: 0.75rem; color: #8b949e;">${item.timestamp}</div>
        </div>
    `).join('');
}