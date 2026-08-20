import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../js/shortcuts/runtime.js', import.meta.url), 'utf8');
const markup = await readFile(new URL('../js/shortcuts/runtime-markup.js', import.meta.url), 'utf8');
const tray = await readFile(new URL('../js/tray-controls.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const roller = await readFile(new URL('../js/roller.js', import.meta.url), 'utf8');
const physics = await readFile(new URL('../js/physics.js', import.meta.url), 'utf8');

for (const required of [
  "from './shortcuts/runtime.js'",
  "from './shortcuts/runtime-markup.js'",
  "ensureStylesheet('shortcut-toolbar-styles', '/shortcut-toolbar.css')",
  'ensureShortcutRuntimeMarkup()',
  'isShortcutPrepared()',
  'performPreparedShortcutRoll()',
  'canRollPreparedShortcutFromTray()',
  'button.disabled = state.rolling || shortcutPrepared',
  '#desktop-custom-die-roll-btn',
  '#custom-die-roll-btn',
]) {
  assert.ok(app.includes(required), `Phase 6 app integration missing: ${required}`);
}

for (const required of [
  "location.hostname.startsWith('deploy-preview-')",
  "get('shortcutDemo') === '1'",
  'loadShortcutWorkspace()',
  'renderShortcutToolbar(',
  'executeShortcutRoll(compiled.plan',
  'rollPhysics(notation, color)',
  "compiled.entry?.scalingMode === 'slot'",
  'getNextRollChangingVariantId',
  'active = null;',
  'TOTAL DAMAGE =',
  "showCrit('nat20')",
  "section.hidden = !accountUser && !demoMode",
  "title.textContent = 'Press ⚙ to configure'",
  'note.hidden = !hasShortcuts',
]) {
  assert.ok(runtime.includes(required), `Phase 6 runtime contract missing: ${required}`);
}
assert.ok(runtime.includes('state.selectedDice = [];'), 'Preparing a shortcut must replace the ordinary selected pool.');
assert.ok(!runtime.includes('state.selectedDice.push'), 'Shortcut runtime must never encode shortcut dice into ordinary selectedDice.');
assert.ok(runtime.includes('const available = Boolean(accountUser || demoMode);'), 'Customization gear must stay hidden for ordinary guests.');
assert.ok(runtime.includes('if (mobileHint) mobileHint.hidden = !available;'), 'Mobile setup hint must match shortcut gear availability.');
assert.ok(runtime.includes('slots = [];'), 'Signed-out non-demo sessions must collapse the toolbar.');

for (const required of [
  "section.id = 'shortcut-toolbar-section'",
  "toolbar.id = 'shortcut-toolbar'",
  "tooltip.id = 'shortcut-tooltip'",
  "wrapRollButton('roll-btn', 'shortcut-settings-btn'",
  "wrapRollButton('mobile-roll-btn', 'mobile-shortcut-settings-btn'",
  "title.style.fontSize = '.86rem'",
  "title.style.letterSpacing = '.04em'",
  "hint.id = 'mobile-shortcut-hint'",
  "hint.textContent = 'Press ⚙ to configure'",
  "hint.style.fontSize = '.86rem'",
  'actionRow.before(hint)',
  'ensureMobileShortcutHint()',
]) {
  assert.ok(markup.includes(required), `Phase 6 runtime markup missing: ${required}`);
}

assert.ok(tray.includes('export function initTrayControls(onRoll, canRoll = defaultCanRoll)'), 'Tray control must accept injected readiness without changing its default behavior.');
assert.ok(tray.includes("document.addEventListener('shortcutstatechange', syncTrayState)"), 'Tray readiness must react to prepared shortcut state.');
assert.ok(tray.includes('export function canRollFromTray(snapshot = state)'), 'Original normal tray readiness API must remain intact.');

assert.ok(!index.includes('shortcut-toolbar-section'), 'Base HTML must remain unchanged; shortcut UI is progressive enhancement.');
assert.ok(!index.includes('shortcut-settings-btn'), 'Guest base markup must not contain a visible shortcut gear.');
assert.ok(!roller.includes('shortcuts/runtime'), 'Ordinary roller module must remain unaware of shortcut runtime.');
assert.ok(!physics.includes('shortcuts/runtime'), 'Physics module must remain unaware of shortcut runtime.');
assert.ok(physics.includes('export async function rollPhysics(notation, themeColor)'), 'Existing DiceBox physics boundary must remain intact.');

console.log('Shortcut live integration checks passed.');
