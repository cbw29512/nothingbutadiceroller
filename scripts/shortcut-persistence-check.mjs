import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BUILTIN_ICON_IDS,
  MAX_SHORTCUTS,
  ShortcutWorkspaceValidationError,
  createEmptyShortcutWorkspace,
  createStoredShortcutWorkspace,
  hydrateShortcutSlot,
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
        {
          id: 'attack',
          label: 'Attack',
          kind: 'attack',
          repeat: 1,
          terms: [{ count: 1, sides: 20 }],
          modifier: 6,
          crit: { policy: 'none' },
        },
        {
          id: 'slashing',
          label: 'Slashing damage',
          kind: 'damage',
          damageType: 'slashing',
          repeat: 1,
          terms: [{ count: 2, sides: 6 }],
          modifier: 11,
          crit: { policy: 'double-dice', triggerGroupId: 'attack' },
        },
        {
          id: 'fire',
          label: 'Fire damage',
          kind: 'damage',
          damageType: 'fire',
          repeat: 1,
          terms: [{ count: 1, sides: 6 }],
          modifier: 0,
          crit: { policy: 'double-dice', triggerGroupId: 'attack' },
        },
      ],
    }],
  };
}

const empty = createEmptyShortcutWorkspace();
assert.equal(empty.schemaVersion, 1);
assert.equal(empty.revision, 0);
assert.equal(empty.updatedAt, null);
assert.deepEqual(empty.shortcuts, []);
assert.equal(Object.isFrozen(empty), true);

const fireballSlot = normalizeShortcutSlots([{
  id: 'fireball-main',
  source: 'raw',
  ruleset: 'dnd5e-2024',
  spellId: 'fireball',
}])[0];
assert.equal(fireballSlot.baseVariantId, 'slot-3');
assert.equal(fireballSlot.icon, 'flame');
assert.deepEqual(fireballSlot.inputs, {});
assert.equal(Object.prototype.hasOwnProperty.call(fireballSlot, 'definition'), false);

const fireBoltSlot = normalizeShortcutSlots([{
  id: 'fire-bolt-main',
  source: 'raw',
  ruleset: 'dnd5e-2024',
  spellId: 'fire-bolt',
  icon: 'bolt',
  baseVariantId: 'tier-3',
  inputs: { toHit: 9 },
}])[0];
assert.equal(fireBoltSlot.baseVariantId, 'tier-3');
assert.equal(fireBoltSlot.inputs.toHit, 9);
assert.equal(BUILTIN_ICON_IDS.includes(fireBoltSlot.icon), true);

const hydrated = hydrateShortcutSlot(fireBoltSlot);
assert.equal(hydrated.definition.source, 'raw');
assert.equal(hydrated.definition.variants[2].groups[0].modifier, 0);
const fireBoltEntry = getRawSpell('dnd5e-2024', 'fire-bolt');
const fireBoltPlan = compileRawCatalogEntry(fireBoltEntry, {
  variantId: fireBoltSlot.baseVariantId,
  inputs: fireBoltSlot.inputs,
});
assert.equal(fireBoltPlan.groups[0].instances[0].modifier, 9);
assert.equal(fireBoltEntry.shortcut.variants[2].groups[0].modifier, 0);

assert.throws(() => normalizeShortcutSlots([{
  id: 'bad-fire-bolt',
  source: 'raw',
  ruleset: 'dnd5e-2024',
  spellId: 'fire-bolt',
  baseVariantId: 'tier-2',
}]), ShortcutWorkspaceValidationError);

assert.throws(() => normalizeShortcutSlots([{
  id: 'tampered-fireball',
  source: 'raw',
  ruleset: 'dnd5e-2024',
  spellId: 'fireball',
  definition: flexDefinition('fake-raw-copy'),
}]), (error) => error instanceof ShortcutWorkspaceValidationError && error.issues.some((issue) => issue.includes('definition is not allowed')));

assert.throws(() => normalizeShortcutSlots([{
  id: 'unknown-raw',
  source: 'raw',
  ruleset: 'dnd5e-2024',
  spellId: 'not-in-verified-catalog',
}]), ShortcutWorkspaceValidationError);

assert.throws(() => normalizeShortcutSlots([{
  id: 'fireball-with-hit',
  source: 'raw',
  ruleset: 'dnd5e-2024',
  spellId: 'fireball',
  inputs: { toHit: 7 },
}]), ShortcutWorkspaceValidationError);

const flexSlot = normalizeShortcutSlots([{
  id: 'flaming-greatsword-slot',
  source: 'flex',
  icon: 'flame',
  definition: flexDefinition(),
}])[0];
assert.equal(flexSlot.source, 'flex');
assert.equal(flexSlot.baseVariantId, 'base');
assert.equal(flexSlot.icon, 'flame');
assert.equal(flexSlot.definition.name, 'Flaming Greatsword');
assert.equal(Object.isFrozen(flexSlot.definition), true);

const twentyFour = Array.from({ length: MAX_SHORTCUTS }, (_, index) => ({
  id: `fireball-${index + 1}`,
  source: 'raw',
  ruleset: index % 2 ? 'dnd5e-2014' : 'dnd5e-2024',
  spellId: 'fireball',
}));
assert.equal(normalizeShortcutSlots(twentyFour).length, MAX_SHORTCUTS);
assert.throws(() => normalizeShortcutSlots([...twentyFour, {
  id: 'fireball-25', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fireball',
}]), ShortcutWorkspaceValidationError);
assert.throws(() => normalizeShortcutSlots([twentyFour[0], twentyFour[0]]), ShortcutWorkspaceValidationError);

const stored = createStoredShortcutWorkspace([fireballSlot, fireBoltSlot, flexSlot], {
  revision: 4,
  updatedAt: '2026-08-20T01:00:00.000Z',
});
const revalidated = validateStoredShortcutWorkspace(structuredClone(stored));
assert.equal(revalidated.revision, 4);
assert.equal(revalidated.shortcuts.length, 3);
assert.equal(revalidated.shortcuts[1].inputs.toHit, 9);
assert.throws(() => validateStoredShortcutWorkspace({ ...structuredClone(stored), extra: true }), ShortcutWorkspaceValidationError);
assert.throws(() => validateStoredShortcutWorkspace({ ...structuredClone(stored), schemaVersion: 999 }), ShortcutWorkspaceValidationError);

const apiSource = await readFile(new URL('../netlify/functions/shortcuts.mjs', import.meta.url), 'utf8');
const clientSource = await readFile(new URL('../js/shortcuts/persistence-client.mjs', import.meta.url), 'utf8');
const mainAppSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const mainHtmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

for (const required of [
  "getUser()",
  'verifyRequestOrigin(request)',
  "getStore({ name: STORE_NAME, consistency: 'strong' })",
  "getWithMetadata(key, { type: 'json', consistency: 'strong' })",
  'onlyIfMatch: current.version',
  'onlyIfNew: true',
  "config = { path: '/api/shortcuts' }",
  "code: 'shortcut-version-conflict'",
  'validateStoredShortcutWorkspace(entry.data)',
]) {
  assert.ok(apiSource.includes(required), `Shortcut API contract missing: ${required}`);
}
assert.ok(apiSource.includes('encodeURIComponent(String(userId))'), 'Storage key must be derived from authenticated user id.');
assert.ok(!apiSource.includes('return []'), 'Shortcut storage must not convert read failures into an empty collection.');
assert.ok(!apiSource.includes('body.userId'), 'Shortcut API must never accept a caller-supplied user id.');

for (const required of [
  "credentials: 'include'",
  "fetch('/api/shortcuts'",
  "shortcut-version-required",
  "shortcut-persistence-error",
]) {
  assert.ok(clientSource.includes(required), `Shortcut persistence client contract missing: ${required}`);
}

assert.ok(!mainAppSource.includes('persistence-client.mjs'), 'Phase 3 must not wire shortcut persistence into the live roller yet.');
assert.ok(!mainHtmlSource.includes('/api/shortcuts'), 'Phase 3 must not add shortcut controls to the production page yet.');

console.log('Shortcut persistence checks passed.');
