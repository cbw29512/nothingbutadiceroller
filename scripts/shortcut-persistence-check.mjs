import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BUILTIN_ICON_IDS,
  DEFAULT_SHORTCUT_OPTIONS,
  MAX_SHORTCUTS,
  SHORTCUT_WORKSPACE_SCHEMA_VERSION,
  ShortcutWorkspaceValidationError,
  createEmptyShortcutWorkspace,
  createStoredShortcutWorkspace,
  hydrateShortcutSlot,
  normalizeShortcutOptions,
  normalizeShortcutSlots,
  validateStoredShortcutWorkspace,
} from '../js/shortcuts/index.mjs';
import { compileRawCatalogEntry, getRawSpell } from '../js/shortcuts/raw/index.mjs';

function flexDefinition(id = 'flaming-greatsword') {
  return {
    schemaVersion: 1,
    source: 'flex',
    id,
    name: 'Flaming Greatsword',
    icon: 'sword',
    category: 'attack',
    variants: [{
      id: 'base',
      label: 'Base',
      scaleRank: 0,
      groups: [
        { id: 'attack', label: 'Attack', kind: 'attack', repeat: 1, terms: [{ count: 1, sides: 20 }], modifier: 6, crit: { policy: 'none' } },
        { id: 'slashing', label: 'Slashing damage', kind: 'damage', damageType: 'slashing', repeat: 1, terms: [{ count: 2, sides: 6 }], modifier: 11, crit: { policy: 'double-dice', triggerGroupId: 'attack' } },
      ],
    }],
  };
}

const empty = createEmptyShortcutWorkspace();
assert.equal(empty.schemaVersion, SHORTCUT_WORKSPACE_SCHEMA_VERSION);
assert.equal(empty.schemaVersion, 2);
assert.equal(empty.revision, 0);
assert.equal(empty.updatedAt, null);
assert.deepEqual(empty.shortcuts, []);
assert.deepEqual(empty.options, DEFAULT_SHORTCUT_OPTIONS);
assert.equal(Object.isFrozen(empty), true);

assert.deepEqual(
  normalizeShortcutOptions({ criticalMode: 'custom', preferredRuleset: 'dnd5e-2014' }),
  { criticalMode: 'custom', preferredRuleset: 'dnd5e-2014' },
);
assert.throws(() => normalizeShortcutOptions({ criticalMode: 'arbitrary-code' }), ShortcutWorkspaceValidationError);

const fireballSlot = normalizeShortcutSlots([{ id: 'fireball-main', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fireball' }])[0];
assert.equal(fireballSlot.baseVariantId, 'slot-3');
assert.equal(fireballSlot.icon, 'flame');
assert.deepEqual(fireballSlot.inputs, {});
assert.equal(Object.prototype.hasOwnProperty.call(fireballSlot, 'definition'), false);

const fireBoltSlot = normalizeShortcutSlots([{
  id: 'fire-bolt-main', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fire-bolt', icon: 'bolt', baseVariantId: 'tier-3', inputs: { toHit: 9 },
}])[0];
assert.equal(fireBoltSlot.baseVariantId, 'tier-3');
assert.equal(fireBoltSlot.inputs.toHit, 9);
assert.equal(BUILTIN_ICON_IDS.includes(fireBoltSlot.icon), true);

const hydrated = hydrateShortcutSlot(fireBoltSlot);
assert.equal(hydrated.definition.source, 'raw');
assert.equal(hydrated.definition.variants[2].groups[0].modifier, 0);
const fireBoltEntry = getRawSpell('dnd5e-2024', 'fire-bolt');
const fireBoltPlan = compileRawCatalogEntry(fireBoltEntry, { variantId: fireBoltSlot.baseVariantId, inputs: fireBoltSlot.inputs });
assert.equal(fireBoltPlan.groups[0].instances[0].modifier, 9);
assert.equal(fireBoltEntry.shortcut.variants[2].groups[0].modifier, 0);

assert.throws(() => normalizeShortcutSlots([{ id: 'bad-fire-bolt', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fire-bolt', baseVariantId: 'tier-2' }]), ShortcutWorkspaceValidationError);
assert.throws(() => normalizeShortcutSlots([{ id: 'tampered-fireball', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fireball', definition: flexDefinition('fake-raw-copy') }]), ShortcutWorkspaceValidationError);

const flexSlot = normalizeShortcutSlots([{ id: 'flaming-greatsword-slot', source: 'flex', icon: 'flame', definition: flexDefinition() }])[0];
assert.equal(flexSlot.source, 'flex');
assert.equal(flexSlot.baseVariantId, 'base');
assert.equal(Object.isFrozen(flexSlot.definition), true);

const twentyFour = Array.from({ length: MAX_SHORTCUTS }, (_, index) => ({
  id: `fireball-${index + 1}`, source: 'raw', ruleset: index % 2 ? 'dnd5e-2014' : 'dnd5e-2024', spellId: 'fireball',
}));
assert.equal(normalizeShortcutSlots(twentyFour).length, MAX_SHORTCUTS);
assert.throws(() => normalizeShortcutSlots([...twentyFour, { id: 'fireball-25', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fireball' }]), ShortcutWorkspaceValidationError);

const stored = createStoredShortcutWorkspace([fireballSlot, fireBoltSlot, flexSlot], {
  revision: 4,
  updatedAt: '2026-08-20T01:00:00.000Z',
  options: { criticalMode: 'custom', preferredRuleset: 'dnd5e-2014' },
});
const revalidated = validateStoredShortcutWorkspace(structuredClone(stored));
assert.equal(revalidated.revision, 4);
assert.equal(revalidated.shortcuts.length, 3);
assert.equal(revalidated.options.criticalMode, 'custom');
assert.equal(revalidated.options.preferredRuleset, 'dnd5e-2014');

const legacy = validateStoredShortcutWorkspace({
  schemaVersion: 1,
  revision: 3,
  updatedAt: '2026-08-19T20:00:00.000Z',
  shortcuts: [fireballSlot],
});
assert.equal(legacy.schemaVersion, 2);
assert.deepEqual(legacy.options, DEFAULT_SHORTCUT_OPTIONS);
assert.equal(legacy.shortcuts.length, 1);
assert.throws(() => validateStoredShortcutWorkspace({ ...structuredClone(stored), extra: true }), ShortcutWorkspaceValidationError);
assert.throws(() => validateStoredShortcutWorkspace({ ...structuredClone(stored), schemaVersion: 999 }), ShortcutWorkspaceValidationError);

const apiSource = await readFile(new URL('../netlify/functions/shortcuts.mjs', import.meta.url), 'utf8');
const clientSource = await readFile(new URL('../js/shortcuts/persistence-client.mjs', import.meta.url), 'utf8');
const localSource = await readFile(new URL('../js/shortcuts/local-persistence.mjs', import.meta.url), 'utf8');
const managerSessionSource = await readFile(new URL('../js/shortcuts/manager-session.mjs', import.meta.url), 'utf8');
const runtimeSource = await readFile(new URL('../js/shortcuts/runtime.js', import.meta.url), 'utf8');
for (const required of [
  'verifyRequestOrigin(request)',
  "getStore({ name: STORE_NAME, consistency: 'strong' })",
  'onlyIfMatch: current.version',
  'onlyIfNew: true',
  "'version', 'shortcuts', 'options'",
  'normalizeShortcutOptions(body.options)',
  "config = { path: '/api/shortcuts' }",
  "code: 'shortcut-version-conflict'",
  'validateStoredShortcutWorkspace(entry.data)',
]) assert.ok(apiSource.includes(required), `Shortcut API contract missing: ${required}`);
assert.ok(apiSource.includes('encodeURIComponent(String(userId))'));
assert.ok(!apiSource.includes('body.userId'));
for (const required of ["credentials: 'include'", "fetch('/api/shortcuts'", 'normalizeShortcutOptions(options)', "shortcut-version-required", "shortcut-persistence-error"]) {
  assert.ok(clientSource.includes(required), `Shortcut persistence client contract missing: ${required}`);
}
for (const required of [
  'LOCAL_SHORTCUT_WORKSPACE_KEY', 'validateStoredShortcutWorkspace(JSON.parse(raw))',
  'createStoredShortcutWorkspace(shortcuts', 'current.revision + 1', 'storage().setItem(',
]) assert.ok(localSource.includes(required), `Local shortcut persistence contract missing: ${required}`);
assert.ok(managerSessionSource.includes('loadLocalShortcutWorkspace()'));
assert.ok(managerSessionSource.includes('saveLocalShortcutWorkspace(managerContext.shortcuts, managerContext.options)'));
assert.ok(runtimeSource.includes('loadLocalShortcutWorkspace().workspace.shortcuts'));

const originalLocalStorage = globalThis.localStorage;
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
const { loadLocalShortcutWorkspace, saveLocalShortcutWorkspace } = await import('../js/shortcuts/local-persistence.mjs');
assert.deepEqual(loadLocalShortcutWorkspace().workspace.shortcuts, []);
const locallySaved = saveLocalShortcutWorkspace([fireballSlot], { criticalMode: 'raw', preferredRuleset: 'dnd5e-2014' });
assert.equal(locallySaved.workspace.revision, 1);
assert.equal(locallySaved.workspace.shortcuts[0].spellId, 'fireball');
assert.equal(loadLocalShortcutWorkspace().workspace.options.preferredRuleset, 'dnd5e-2014');
if (originalLocalStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = originalLocalStorage;

console.log('Shortcut persistence checks passed.');
