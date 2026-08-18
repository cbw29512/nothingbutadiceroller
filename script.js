let selectedDice = [];
let currentAdvantage = 'normal';
let rollHistory = [];
let diceBox = null;
let currentTheme = localStorage.getItem('dice_theme') || 'default';
let currentTrayColor = localStorage.getItem('dice_tray_color') || '#0d2818';

document.addEventListener('DOMContentLoaded', async () => {
    loadSavedCustomDice();
    await initDicePhysics();
    setupDiceSelector();
    setupAdvantageToggle();
    setupActions();
});

async function initDicePhysics() {
    try {
        diceBox = new DiceBox({
            element: '#diceTray',
            assetPath: 'https://unpkg.com/@3d-dice/dice-box@1.1.5/dist/assets/',
            theme: currentTheme,
            loader: 'generic',
            gravity: 1,
            mass: 1,
            friction: 0.8,
            restitution: 0.2,
            linearDamping: 0.5,
            angularDamping: 0.4,
            startingHeight: 8,
            spinForce: 6,
            throwForce: 6,
            scale: 6
        });

        await diceBox.init();
        document.getElementById('diceTray').style.backgroundColor = currentTrayColor;
    } catch (e) {
        console.error("Failed to initialize 3D dice physics engine:", e);
    }
}

function loadSavedCustomDice() {
    try {
        const saved = JSON.parse(localStorage.getItem('saved_custom_dice') || '[]');
        const selector = document.getElementById('diceSelectorGrid');
        const customBtnNode = document.getElementById('customDieBtn');

        saved.forEach(die => {
            if (!document.querySelector(`.die-btn[data-die="${die}"]`)) {
                const btn = document.createElement('button');
                btn.className = 'die-btn saved-custom';
                btn.setAttribute('data-die', die);
                btn.textContent = die;
                selector.insertBefore(btn, customBtnNode);
            }
        });
    } catch (e) {
        console.error("Error loading custom dice:", e);
    }
}

function setupDiceSelector() {
    const selector = document.getElementById('diceSelectorGrid');
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

                    try {
                        let saved = JSON.parse(localStorage.getItem('saved_custom_dice') || '[]');
                        if (!saved.includes(customDie)) {
                            saved.push(customDie);
                            localStorage.setItem('saved_custom_dice', JSON.stringify(saved));
                        }
                    } catch (err) {
                        console.error("Error saving custom die:", err);
                    }

                    if (!document.querySelector(`.die-btn[data-die="${customDie}"]`)) {
                        const newBtn = document.createElement('button');
                        newBtn.className = 'die-btn saved-custom';
                        newBtn.setAttribute('data-die', customDie);
                        newBtn.textContent = customDie;
                        selector.insertBefore(newBtn, document.getElementById('customDieBtn'));
                    }

                    const targetBtn = document.querySelector(`.die-btn[data-die="${customDie}"]`);
                    if (targetBtn && !targetBtn.classList.contains('selected')) {
                        targetBtn.classList.add('selected');
                        selectedDice.push(customDie);
                    }
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

async function executeRoll() {
    if (currentAdvantage !== 'normal' && !selectedDice.includes('d20')) {
        selectedDice.push('d20');
    }

    if (selectedDice.length === 0) {
        alert('Please select at least one die to roll!');
        return;
    }

    if (!diceBox) {
        alert('3D physics engine is still loading. Please wait a second and try again.');
        return;
    }

    let rollNotationParts = [];
    selectedDice.forEach(die => {
        if (die === 'd20' && currentAdvantage !== 'normal') {
            rollNotationParts.push('2d20');
        } else {
            rollNotationParts.push(`1${die}`);
        }
    });

    const notation = rollNotationParts.join('+');

    try {
        const results = await diceBox.roll(notation);
        
        let totalSum = 0;
        let breakdownParts = [];
        let rollRecords = [];

        if (Array.isArray(results)) {
            let d20Results = results.filter(r => r.sides === 20 || r.type === 'd20');
            let otherResults = results.filter(r => r.sides !== 20 && r.type !== 'd20');

            if (currentAdvantage !== 'normal' && d20Results.length >= 2) {
                d20Results.sort((a, b) => a.value - b.value);
                const lowest = d20Results[0].value;
                const highest = d20Results[1].value;
                const kept = currentAdvantage === 'advantage' ? highest : lowest;
                const dropped = currentAdvantage === 'advantage' ? lowest : highest;

                totalSum += kept;
                breakdownParts.push(`d20 (${currentAdvantage}): ${kept} [${lowest}, ${highest}]`);
                rollRecords.push({ die: 'd20', result: kept, display: `${kept} (${lowest}, ${highest} ${currentAdvantage === 'advantage' ? 'adv' : 'dis'})` });
            } else {
                d20Results.forEach(r => {
                    totalSum += r.value;
                    breakdownParts.push(`d20: ${r.value}`);
                    rollRecords.push({ die: 'd20', result: r.value, display: `${r.value}` });
                });
            }

            otherResults.forEach(r => {
                totalSum += r.value;
                const dieName = `d${r.sides || r.type.replace('d','')}`;
                breakdownParts.push(`${dieName}: ${r.value}`);
                rollRecords.push({ die: dieName, result: r.value, display: `${r.value}` });
            });
        }

        document.getElementById('totalNumber').textContent = totalSum;
        document.getElementById('breakdownText').textContent = breakdownParts.join(' | ') || `Total: ${results.reduce((sum, r) => sum + r.value, 0)}`;

        rollHistory.unshift({
            timestamp: new Date().toLocaleTimeString(),
            rolls: rollRecords.length > 0 ? rollRecords : results.map(r => ({ die: r.type, result: r.value, display: r.value })),
            total: totalSum > 0 ? totalSum : results.reduce((sum, r) => sum + r.value, 0)
        });
        updateHistoryUI();

    } catch (err) {
        console.error("Roll execution error:", err);
    }
}

function clearTray() {
    if (diceBox) {
        diceBox.clear();
    }
    document.getElementById('totalNumber').textContent = '0';
    document.getElementById('breakdownText').textContent = 'No active roll';
    
    selectedDice = [];
    document.querySelectorAll('.die-btn').forEach(b => b.classList.remove('selected'));
    
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

async function setTheme(themeName) {
    currentTheme = themeName;
    localStorage.setItem('dice_theme', themeName);
    if (diceBox) {
        await diceBox.updateConfig({ theme: themeName });
    }
    closeThemes();
}

function setTray(colorHex) {
    currentTrayColor = colorHex;
    localStorage.setItem('dice_tray_color', colorHex);
    document.getElementById('diceTray').style.backgroundColor = colorHex;
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