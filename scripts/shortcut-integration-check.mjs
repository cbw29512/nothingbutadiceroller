import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../js/shortcuts/runtime.js', import.meta.url), 'utf8');
const presentation = await readFile(new URL('../js/shortcuts/result-presentation.mjs', import.meta.url), 'utf8');
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
  "from './result-presentation.mjs'",
  'formatShortcutResult(execution)',
  'shortcutDisplayTotal(execution)',
  'shortcutHistoryTotal(execution)',
  "showCrit('nat20')",
  'section.hidden = false',
  'note.hidden = !hasShortcuts',
  'return Boolean(active);',
]) {
  assert.ok(runtime.includes(required), `Phase 6 runtime contract missing: ${required}`);
}

assert.ok(!runtime.includes('Bolean('), 'Shortcut prepared-state predicate must use the native Boolean constructor.');

for (const required of [
  'TOTAL DAMAGE =',
  'TOTAL HEALING =',
  "hasResultKind(execution, 'damage')",
  "hasResultKind(execution, 'healing')",
]) {
  assert.ok(presentation.includes(required), `Shortcut result presentation contract missing: ${required}`);
}

assert.ok(runtime.includes('state.selectedDice = [];'), 'Preparing a shortcut must replace the ordinary selected pool.');
assert.ok(!runtime.includes('state.selectedDice.push'), 'Shortcut runtime must never encode shortcut dice into ordinary selectedDice.');
assert.ok(runtime.includes('const available = true;'), 'Customization gear must remain available for local guest shortcuts.');
assert.ok(runtime.includes('if (mobileHint) mobileHint.hidden = !available;'), 'Runtime must keep the shortcut gear/hint mount available before onboarding polish runs.');
assert.ok(runtime.includes('slots = loadLocalShortcutWorkspace().workspace.shortcuts;'), 'Signed-out sessions must load local guest shortcuts.');

for (const required of [
  "section.id = 'shortcut-toolbar-section'",
  "anchor.id = 'shortcut-toolbar-desktop-anchor'",
  "toolbar.id = 'shortcut-toolbar'",
  "tooltip.id = 'shortcut-tooltip'",
  "wrapRollButton('roll-btn', 'shortcut-settings-btn'",
  "wrapRollButton('mobile-roll-btn', 'mobile-shortcut-settings-btn'",
  "title.className = 'section-label shortcut-toolbar-title'",
  "note.textContent = 'Hold or focus for details'",
  "hint.id = 'mobile-shortcut-hint'",
  "hint.className = 'mobile-shortcut-hint'",
  "hint.textContent = 'Customize roll shortcuts → ⚙'",
  "mount.id = 'mobile-shortcut-toolbar-mount'",
  'function syncShortcutToolbarMount()',
  "globalThis.matchMedia?.(MOBILE_SHORTCUT_QUERY)",
  'if (mobileShortcutLayoutActive()) mobileMount.append(section)',
  "title.textContent = configured ? 'My shortcuts' : 'Customize roll shortcuts → ⚙'",
  'mobileHint.hidden = configured',
  'mobileMount.hidden = !(configured && mobileShortcutLayoutActive())',
  'observeShortcutToolbarMount()',
  'observeShortcutOnboarding()',
  'actionRow.before(hint)',
  'ensureMobileShortcutHint()',
  'ensureMobileShortcutMount()',
]) {
  assert.ok(markup.includes(required), `Phase 6 runtime markup/onboarding missing: ${required}`);
}
assert.equal(markup.includes('.style.'), false, 'Shortcut runtime markup must not rely on CSP-blocked inline style properties.');

assert.ok(tray.includes('export function initTrayControls(onRoll, canRoll = defaultCanRoll)'), 'Tray control must accept injected readiness without changing its default behavior.');
assert.ok(tray.includes("document.addEventListener('shortcutstatechange', syncTrayState)"), 'Tray readiness must react to prepared shortcut state.');
assert.ok(tray.includes('export function canRollFromTray(snapshot = state)'), 'Original normal tray readiness API must remain intact.');

assert.ok(!index.includes('shortcut-toolbar-section'), 'Base HTML must remain unchanged; shortcut UI is progressive enhancement.');
assert.ok(!index.includes('shortcut-settings-btn'), 'Guest base markup must not contain a visible shortcut gear.');
assert.ok(!roller.includes('shortcuts/runtime'), 'Ordinary roller module must remain unaware of shortcut runtime.');
assert.ok(!physics.includes('shortcuts/runtime'), 'Physics module must remain unaware of shortcut runtime.');
assert.ok(physics.includes('export async function rollPhysics(notation, themeColor)'), 'Existing DiceBox physics boundary must remain intact.');

console.log('Shortcut live integration and onboarding checks passed.');
