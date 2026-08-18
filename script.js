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
    const dieButtons = document.querySelectorAll('.die-btn');
    dieButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const die = btn.getAttribute('data-die');
            if (btn.classList.contains('selected')) {
                btn.classList.remove('selected');
                selectedDice = selectedDice.filter(d => d !== die);
            } else {
                btn.classList.add('selected');
                selectedDice.push(die);
            }
        });
    });
}

function setupAdvantageToggle() {
    const advButtons = document.querySelectorAll('.adv-btn');
    advButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            advButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAdvantage = btn.getAttribute('data-adv');

            // Automatically select d20 when advantage or disadvantage is chosen
            const d20Btn = document.querySelector('.die-btn[data-die="d20"]');
            if (currentAdvantage !== 'normal') {
                if (!selectedDice.includes('d20')) {
                    selectedDice.push('d20');
                    if (d20Btn) d20Btn.classList.add('selected');
                }
            }
        });
    });
}

function setupActions() {
    document.getElementById('rollBtn').addEventListener('click', executeRoll);
    document.getElementById('clearBtn').addEventListener('click', clearTray);
}

function executeRoll() {
    // Safety check: ensure d20 is included if advantage/disadvantage is active
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

    selectedDice.forEach(die => {
        const sides = parseInt(die.substring(1));
        let rollResult = 0;
        let displayVal = '';

        if (die === 'd20' && currentAdvantage !== 'normal') {
            const roll1 = Math.floor(Math.random() * 20) + 1;
            const roll2 = Math.floor(Math.random() * 20) + 1;
            if (currentAdvantage === 'advantage') {
                rollResult = Math.max(roll1, roll2);
                displayVal = `${rollResult} (${roll1}, ${roll2} adv)`;
            } else {
                rollResult = Math.min(roll1, roll2);
                displayVal = `${rollResult} (${roll1}, ${roll2} dis)`;
            }
        } else {
            rollResult = Math.floor(Math.random() * sides) + 1;
            displayVal = `${rollResult}`;
        }

        totalSum += rollResult;
        breakdownParts.push(`${die}: ${displayVal}`);
        currentRollRecord.rolls.push({ die, result: rollResult, display: displayVal });

        const dieEl = document.createElement('div');
        dieEl.className = 'rolled-die';
        const skin = skinColors[currentSkin] || skinColors.ruby_red;
        dieEl.style.backgroundColor = skin.bg;
        dieEl.style.color = skin.text;
        dieEl.innerHTML = `<span style="font-size:0.65rem;">${die.toUpperCase()}</span><span style="font-size:1.1rem;">${rollResult}</span>`;
        tray.appendChild(dieEl);
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
    
    // Reset advantage back to normal on clear
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