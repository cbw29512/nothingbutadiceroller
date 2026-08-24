import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatShortcutResult,
  shortcutDisplayTotal,
  shortcutHistoryTotal,
} from '../js/shortcuts/result-presentation.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const [app, authUi] = await Promise.all([
  readFile(resolve(root, 'js/app.js'), 'utf8'),
  readFile(resolve(root, 'js/auth-ui.js'), 'utf8'),
]);

assert.ok(!app.includes("stylesButton.textContent = 'Customize'"), 'Runtime must not rename Dice Studio to Customize.');
assert.ok(!authUi.includes('dice configurations permanently'), 'Auth UI must not claim account storage is permanent.');
assert.ok(authUi.includes('save dice configurations to your account and load them on other devices.'), 'Auth UI must use the approved account-storage wording.');

function zeroExecution(kind) {
  return {
    resolvedInstances: [{ instanceId: `${kind}-1`, dice: [{ sides: 2, values: [1] }] }],
    result: {
      groups: [{
        id: kind,
        label: kind === 'damage' ? 'Damage' : 'Healing',
        kind,
        damageType: kind === 'damage' ? 'force' : null,
        instances: [{ id: `${kind}-1`, total: 0, modifier: -1 }],
        subtotal: 0,
      }],
      damageTotal: 0,
      healingTotal: 0,
    },
  };
}

const damageZero = zeroExecution('damage');
assert.equal(shortcutDisplayTotal(damageZero), 0, 'Exact-zero damage must display as 0.');
assert.equal(shortcutHistoryTotal(damageZero), 'Damage 0', 'Exact-zero damage history must say Damage 0.');
assert.match(formatShortcutResult(damageZero), /TOTAL DAMAGE = 0/, 'Exact-zero damage breakdown must include the zero total.');

const healingZero = zeroExecution('healing');
assert.equal(shortcutDisplayTotal(healingZero), 0, 'Exact-zero healing must display as 0.');
assert.equal(shortcutHistoryTotal(healingZero), 'Healing 0', 'Exact-zero healing history must say Healing 0.');
assert.match(formatShortcutResult(healingZero), /TOTAL HEALING = 0/, 'Exact-zero healing breakdown must include the zero total.');

assert.equal(shortcutDisplayTotal({ result: { groups: [], damageTotal: 0, healingTotal: 0 } }), '—');
assert.equal(shortcutHistoryTotal({ result: { groups: [], damageTotal: 0, healingTotal: 0 } }), 'Grouped');

console.log('Phase 1 regression checks passed.');
