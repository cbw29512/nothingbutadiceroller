import { BUILTIN_ICON_IDS } from './shortcuts/constants.mjs';
import {
  activateShortcutToolbarState,
  clearShortcutToolbarState,
  getShortcutToolbarRowCount,
  moveShortcutToolbarItem,
  renderShortcutToolbar,
} from './shortcuts/toolbar.mjs';

const DEMO_NAMES = Object.freeze([
  'Greatsword', 'Longbow', 'Shield Bash', 'Magic Missile', 'Fireball', 'Cone of Cold',
  'Lightning Bolt', 'Toll the Dead', 'Cure Wounds', 'Guiding Bolt', 'Moonbeam', 'Sacred Flame',
  'Eldritch Blast', 'Shillelagh', 'Primal Savagery', 'Wild Shape', 'Acid Splash', 'Spellbook',
  'Eyebite', 'Mage Hand', 'Spiritual Weapon', 'Greataxe', 'Dagger', 'Custom Roll',
]);

const DEMO_ITEMS = Object.freeze(BUILTIN_ICON_IDS.map((icon, index) => Object.freeze({
  id: `demo-${index + 1}`,
  name: DEMO_NAMES[index],
  icon,
})));

let items = [...DEMO_ITEMS.slice(0, 8)];
let toolbarState = clearShortcutToolbarState();
let activationCount = 0;
let logLines = ['Harness ready.'];

const toolbar = document.getElementById('shortcut-toolbar-harness');
const buttonCount = document.getElementById('harness-button-count');
const rowCount = document.getElementById('harness-row-count');
const activeReadout = document.getElementById('harness-active');
const activations = document.getElementById('harness-activations');
const rollLabel = document.getElementById('harness-roll-label');
const tooltip = document.getElementById('harness-tooltip');
const log = document.getElementById('harness-log');

function activeItem() {
  return toolbarState.activeId ? items.find((item) => item.id === toolbarState.activeId) || null : null;
}

function writeLog(message) {
  logLines = [...logLines.slice(-9), message];
  log.textContent = logLines.join('\n');
  log.scrollTop = log.scrollHeight;
}

function hideInfo() {
  tooltip.hidden = true;
  tooltip.textContent = '';
}

function showInfo(item, _button, source) {
  tooltip.textContent = `${item.name} · ${item.icon} icon · ${source === 'hold' ? 'long-press preview' : 'keyboard focus preview'}`;
  tooltip.hidden = false;
}

function render() {
  const result = renderShortcutToolbar(toolbar, items, {
    activeId: toolbarState.activeId,
    onActivate(item, meta) {
      const before = toolbarState.activeId;
      toolbarState = activateShortcutToolbarState(toolbarState, item.id);
      if (toolbarState.activeId === item.id) {
        activationCount += 1;
        writeLog(`${item.name}: activation ${activationCount} via ${meta.source}${before === item.id ? ' (same active shortcut)' : ''}.`);
      }
      render();
    },
    onInfo: showInfo,
    onInfoHide: hideInfo,
    toolbarLabel: 'Phase 4 saved roll shortcut preview',
  });

  const active = activeItem();
  buttonCount.textContent = String(result.buttonCount);
  rowCount.textContent = String(result.rowCount);
  activeReadout.textContent = active?.name || 'None';
  activations.textContent = String(activationCount);
  rollLabel.textContent = active ? `ROLL ${active.name.toUpperCase()}` : 'ROLL DICE';
  document.querySelectorAll('[data-count]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.count) === items.length);
    button.setAttribute('aria-pressed', String(Number(button.dataset.count) === items.length));
  });
}

function setCount(count) {
  if (!Number.isInteger(count) || count < 0 || count > DEMO_ITEMS.length) return;
  items = [...DEMO_ITEMS.slice(0, count)];
  toolbarState = clearShortcutToolbarState();
  activationCount = 0;
  hideInfo();
  writeLog(`Preset ${count}: expected ${getShortcutToolbarRowCount(count)} row(s).`);
  render();
}

document.querySelectorAll('[data-count]').forEach((button) => {
  button.addEventListener('click', () => setCount(Number(button.dataset.count)));
});

document.getElementById('harness-clear')?.addEventListener('click', () => {
  const active = activeItem();
  toolbarState = clearShortcutToolbarState();
  hideInfo();
  writeLog(active ? `Cleared ${active.name}; all shortcut buttons unlocked.` : 'Clear requested with no active shortcut.');
  render();
});

function moveActive(offset) {
  const active = activeItem();
  if (!active) {
    writeLog('Choose a shortcut before reordering.');
    return;
  }
  const before = items.findIndex((item) => item.id === active.id);
  items = [...moveShortcutToolbarItem(items, active.id, offset)];
  const after = items.findIndex((item) => item.id === active.id);
  writeLog(after === before ? `${active.name} is already at that boundary.` : `${active.name} moved from position ${before + 1} to ${after + 1}.`);
  render();
}

document.getElementById('harness-move-left')?.addEventListener('click', () => moveActive(-1));
document.getElementById('harness-move-right')?.addEventListener('click', () => moveActive(1));
document.getElementById('harness-reset-count')?.addEventListener('click', () => setCount(8));

rollLabel.addEventListener('click', () => {
  const active = activeItem();
  writeLog(active ? `Roll preview requested for ${active.name}; no dice engine is connected in Phase 4.` : 'Roll preview requested with no prepared shortcut.');
});

render();
