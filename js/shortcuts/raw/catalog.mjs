import { RAW_RULESETS } from '../constants.mjs';
import { compileShortcut } from '../compiler.mjs';
import { deepFreeze } from '../schema.mjs';
import { assertValidShortcut } from '../validation.mjs';

export const RAW_CATALOG_SCHEMA_VERSION = 1;
export const RAW_SCALING_MODES = Object.freeze(['fixed', 'slot', 'cantrip-tier']);
export const RAW_INPUT_KEYS = Object.freeze(['toHit']);

const RULESET_TO_SRD = Object.freeze({
  'dnd5e-2014': '5.1',
  'dnd5e-2024': '5.2.1',
});

function assertInteger(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer from ${min} to ${max}`);
}

function assertCatalogEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('RAW catalog entry must be an object');
  if (entry.catalogSchemaVersion !== RAW_CATALOG_SCHEMA_VERSION) throw new Error(`RAW catalog schema must be ${RAW_CATALOG_SCHEMA_VERSION}`);
  if (!RAW_RULESETS.includes(entry.ruleset)) throw new Error(`Invalid RAW ruleset: ${entry.ruleset}`);
  if (entry.srdVersion !== RULESET_TO_SRD[entry.ruleset]) throw new Error(`SRD version ${entry.srdVersion} does not match ${entry.ruleset}`);
  if (typeof entry.spellId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.spellId)) throw new Error('RAW spellId is invalid');
  assertInteger(entry.spellLevel, 'RAW spellLevel', 0, 9);
  if (!RAW_SCALING_MODES.includes(entry.scalingMode)) throw new Error(`Invalid RAW scaling mode: ${entry.scalingMode}`);
  if (!Array.isArray(entry.requiredInputs)) throw new Error('RAW requiredInputs must be an array');
  for (const key of entry.requiredInputs) {
    if (!RAW_INPUT_KEYS.includes(key)) throw new Error(`Unsupported RAW input: ${key}`);
  }
  if (new Set(entry.requiredInputs).size !== entry.requiredInputs.length) throw new Error('RAW requiredInputs cannot contain duplicates');
  if (typeof entry.sourceLocator !== 'string' || entry.sourceLocator.trim().length < 3) throw new Error('RAW sourceLocator is required');

  assertValidShortcut(entry.shortcut, { expectedSource: 'raw' });
  if (entry.shortcut.ruleset !== entry.ruleset) throw new Error('RAW shortcut ruleset must match catalog entry ruleset');
  if (entry.shortcut.id !== entry.spellId) throw new Error('RAW shortcut id must match catalog spellId');
  if (!entry.shortcut.variants.some((variant) => variant.groups.some((group) => group.kind === 'damage'))) {
    throw new Error(`RAW catalog entry ${entry.spellId} must contain player-rolled damage`);
  }
  if (entry.scalingMode === 'fixed' && entry.shortcut.variants.length !== 1) throw new Error(`${entry.spellId} fixed scaling must have exactly one variant`);
  if (entry.spellLevel === 0 && entry.scalingMode !== 'cantrip-tier') throw new Error(`${entry.spellId} cantrip must use cantrip-tier scaling`);
  if (entry.spellLevel > 0 && entry.scalingMode === 'cantrip-tier') throw new Error(`${entry.spellId} leveled spell cannot use cantrip-tier scaling`);

  const hasAttack = entry.shortcut.variants.some((variant) => variant.groups.some((group) => group.kind === 'attack'));
  const needsToHit = entry.requiredInputs.includes('toHit');
  if (hasAttack !== needsToHit) throw new Error(`${entry.spellId} attack-roll presence and toHit input requirement must match`);

  return entry;
}

export function defineRawCatalogEntry(entry) {
  assertCatalogEntry(entry);
  return deepFreeze(structuredClone(entry));
}

function normalizeInputs(entry, inputs = {}) {
  const allowed = new Set(entry.requiredInputs);
  for (const key of Object.keys(inputs)) {
    if (!allowed.has(key)) throw new Error(`RAW input ${key} is not allowed for ${entry.spellId}`);
  }
  const normalized = {};
  for (const key of entry.requiredInputs) {
    const value = inputs[key];
    if (!Number.isInteger(value) || value < -100 || value > 100) throw new Error(`${entry.spellId} requires ${key} as an integer from -100 to 100`);
    normalized[key] = value;
  }
  return normalized;
}

export function compileRawCatalogEntry(entry, { variantId, inputs = {} } = {}) {
  assertCatalogEntry(entry);
  const normalizedInputs = normalizeInputs(entry, inputs);
  const basePlan = compileShortcut(entry.shortcut, { variantId });
  if (!entry.requiredInputs.length) return basePlan;

  const plan = structuredClone(basePlan);
  if (entry.requiredInputs.includes('toHit')) {
    for (const group of plan.groups) {
      if (group.kind !== 'attack') continue;
      for (const instance of group.instances) {
        instance.modifier += normalizedInputs.toHit;
        instance.inputModifier = 'toHit';
      }
    }
  }
  return deepFreeze(plan);
}

export function validateRawCatalog(entries, { ruleset, srdVersion } = {}) {
  if (!Array.isArray(entries)) throw new Error('RAW catalog must be an array');
  const ids = new Set();
  for (const entry of entries) {
    assertCatalogEntry(entry);
    if (ruleset && entry.ruleset !== ruleset) throw new Error(`${entry.spellId} does not match catalog ruleset ${ruleset}`);
    if (srdVersion && entry.srdVersion !== srdVersion) throw new Error(`${entry.spellId} does not match catalog SRD ${srdVersion}`);
    if (ids.has(entry.spellId)) throw new Error(`Duplicate RAW spellId: ${entry.spellId}`);
    ids.add(entry.spellId);
  }
  return entries;
}

export function indexRawCatalog(entries) {
  validateRawCatalog(entries);
  return new Map(entries.map((entry) => [entry.spellId, entry]));
}
