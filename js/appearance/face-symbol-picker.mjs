const SYMBOL_GROUPS = Object.freeze([
  {
    label: 'RPG & fantasy',
    symbols: [
      ['☠', 'skull'], ['⚔', 'crossed swords'], ['★', 'star'], ['♥', 'heart'], ['◆', 'gem'],
      ['✦', 'spark'], ['⚡', 'lightning'], ['☀', 'sun'], ['☾', 'moon'], ['✚', 'healing cross'],
    ],
  },
  {
    label: 'Fate & cards',
    symbols: [
      ['♠', 'spade'], ['♣', 'club'], ['♦', 'diamond'], ['♛', 'queen'], ['♞', 'knight'],
      ['☯', 'balance'], ['∞', 'infinity'], ['⚖', 'scales'], ['⌛', 'hourglass'],
    ],
  },
  {
    label: 'Marks & math',
    symbols: [
      ['✓', 'check'], ['✕', 'cross'], ['!', 'exclamation'], ['?', 'question'], ['+', 'plus'],
      ['−', 'minus'], ['×', 'multiply'], ['÷', 'divide'], ['=', 'equals'], ['#', 'number sign'],
    ],
  },
  {
    label: 'Directions',
    symbols: [
      ['↑', 'up arrow'], ['↓', 'down arrow'], ['←', 'left arrow'], ['→', 'right arrow'],
      ['↻', 'rotate clockwise'], ['↺', 'rotate counterclockwise'],
    ],
  },
]);

function makeSymbolButton(documentRef, symbol, name) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = 'btn ghost';
  button.dataset.faceSymbol = symbol;
  button.dataset.faceEditControl = '';
  button.textContent = symbol;
  button.title = name;
  button.setAttribute('aria-label', `Use ${name} on this die face`);
  return button;
}

function buildPicker(documentRef) {
  const details = documentRef.createElement('details');
  details.id = 'face-symbol-picker';
  details.className = 'studio-group';
  const summary = documentRef.createElement('summary');
  summary.className = 'btn ghost';
  summary.textContent = 'Choose a Symbol';
  details.append(summary);

  const intro = documentRef.createElement('p');
  intro.className = 'studio-note';
  intro.textContent = 'Tap a symbol to put it on the selected face. No keyboard shortcut needed.';
  details.append(intro);

  for (const group of SYMBOL_GROUPS) {
    const label = documentRef.createElement('p');
    label.className = 'studio-note';
    label.innerHTML = `<strong>${group.label}</strong>`;
    const row = documentRef.createElement('div');
    row.className = 'button-row';
    row.setAttribute('aria-label', group.label);
    for (const [symbol, name] of group.symbols) row.append(makeSymbolButton(documentRef, symbol, name));
    details.append(label, row);
  }
  return details;
}

export function bindFaceSymbolPicker({ q, setStatus, documentRef = document }) {
  const input = q('face-value');
  if (!input || documentRef.getElementById('face-symbol-picker')) return;
  const picker = buildPicker(documentRef);
  input.closest('.studio-field')?.insertAdjacentElement('afterend', picker);

  picker.addEventListener('click', (event) => {
    const button = event.target.closest('[data-face-symbol]');
    if (!button || button.disabled || input.disabled) return;
    const symbol = button.dataset.faceSymbol;
    if (!symbol) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    input.value = start !== end
      ? `${input.value.slice(0, start)}${symbol}${input.value.slice(end)}`
      : symbol;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    setStatus(`${button.title} selected for this face. Press Apply Face to keep it.`, 'ready');
  });
}

export { SYMBOL_GROUPS };
