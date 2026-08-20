import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

async function text(path) {
  return readFile(resolve(root, path), 'utf8');
}

const [html, customCss, roller, customRoll, trayControls, ui, state] = await Promise.all([
  text('index.html'),
  text('custom.css'),
  text('js/roller.js'),
  text('js/custom-roll.js'),
  text('js/tray-controls.js'),
  text('js/ui.js'),
  text('js/state.js'),
]);

const standardDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
for (const die of standardDice) {
  assert.ok(
    html.includes(`class="die-btn`) && html.includes(`data-type="${die}"`),
    `Desktop ${die} control must remain present.`,
  );
  assert.ok(
    html.includes(`class="mobile-die-btn`) && html.includes(`data-type="${die}"`),
    `Mobile ${die} control must remain present.`,
  );
}

assert.ok(html.includes('id="desktop-custom-die-btn"'), 'Desktop CUSTOM die must remain present.');
assert.ok(html.includes('id="mobile-custom-die-btn"'), 'Mobile CUSTOM die must remain present.');
assert.ok(html.includes('data-quick-roll="advantage"'), 'ADV control must remain present.');
assert.ok(html.includes('data-quick-roll="disadvantage"'), 'DIS control must remain present.');
assert.ok(html.includes('id="keep-btn"'), 'Keep Dice control must remain present.');
assert.ok(html.includes('Keep dice after roll'), 'Keep Dice wording must remain present.');
assert.ok(html.includes('id="clear-btn"'), 'Desktop Clear must remain present.');
assert.ok(html.includes('id="roll-btn"'), 'Desktop Roll must remain present.');
assert.ok(html.includes('id="mobile-clear-btn"'), 'Mobile Clear must remain present.');
assert.ok(html.includes('id="mobile-roll-btn"'), 'Mobile Roll must remain present.');
assert.ok(html.includes('Choose dice, then roll.'), 'Clean tray onboarding prompt must remain present.');

assert.ok(
  customCss.includes('.dice-tray .roll-trust-badge,.dice-tray .tray-roll-hint{display:none!important}'),
  'Trust copy and tray hint must stay off the rolling pad.',
);

assert.ok(trayControls.includes("tray.addEventListener('click'"), 'Tray click/tap rolling must remain wired.');
assert.ok(trayControls.includes("['Enter', ' ']"), 'Tray Enter/Space rolling must remain wired.');
assert.ok(trayControls.includes('canRollFromTray'), 'Tray eligibility gate must remain wired.');

assert.ok(roller.includes('rollPhysics('), 'Standard rolls must continue through 3D physics.');
assert.ok(roller.includes('state.keepDice'), 'Standard Keep Dice behavior must remain in the roller.');
assert.ok(roller.includes("getCriticalOutcome("), 'Standard critical evaluation must remain in the roller.');
assert.ok(roller.includes("playCriticalFeedback("), 'Standard critical feedback must remain in the roller.');

assert.ok(customRoll.includes('crypto.getRandomValues'), 'CUSTOM rolls must continue using Web Crypto.');
assert.ok(customRoll.includes('UINT32_RANGE'), 'CUSTOM rejection-sampling range must remain present.');
assert.ok(customRoll.includes('value >= limit'), 'CUSTOM modulo-bias rejection must remain present.');
assert.ok(customRoll.includes('MAX_CUSTOM_SIDES = 1_000_000'), 'CUSTOM d1,000,000 maximum must remain present.');

assert.ok(ui.includes("['roll-btn', 'mobile-roll-btn']"), 'Desktop/mobile dynamic Roll labels must stay synchronized.');
assert.ok(ui.includes('formatRollButtonLabel'), 'Dynamic Roll formula labeling must remain available.');
assert.ok(state.includes("keepDice: false"), 'Keep Dice state must remain part of base state.');
assert.ok(state.includes("history: []"), 'Roll history state must remain part of base state.');

console.log(
  'Baseline contract passed: standard/mobile dice controls, CUSTOM, ADV/DIS, clean tray, tray input, 3D physics, Keep Dice, critical feedback, history state, and dynamic Roll labels remain protected.',
);
