import { BUILTIN_ICON_IDS, MAX_SHORTCUTS, RAW_RULESETS } from './constants.mjs';
import { createFlexShortcut, deepFreeze } from './schema.mjs';
import { getRawSpell } from './raw/index.mjs';

export const SHORTCUT_WORKSPACE_SCHEMA_VERSION = 2;
export const SHORTCUT_WORKSPACE_MAX_BYTES = 256_000;
export const SHORTCUT_SLOT_SOURCES = Object.freeze(['raw', 'flex']);
export const SHORTCUT_CRITICAL_MODES = Object.freeze(['raw', 'custom']);
export const SHORTCUT_RULESET_PREFERENCES = Object.freeze(['dnd5e-2024', 'dnd5e-2014']);
export const DEFAULT_SHORTCUT_OPTIONS = deepFreeze({
  criticalMode: 'raw',
  preferredRuleset: 'dnd5e-2024',
});

const SLOT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const STORED_V1_KEYS = new Set(['schemaVersion', 'revision', 'updatedAt', 'shortcuts']);
const STORED_KEYS = new Set(['schemaVersion', 'revision', 'updatedAt', 'shortcuts', 'options']);
const OPTION_KEYS = new Set(['criticalMode', 'preferredRuleset']);
const RAW_SLOT_KEYS = new Set(['id', 'source', 'ruleset', 'spellId', 'icon', 'baseVariantId', 'inputs']);
const FLEX_SLOT_KEYS = new Set(['id', 'source', 'icon', 'baseVariantId', 'definition']);
const INPUT_KEYS = new Set(['toHit']);

export class ShortcutWorkspaceValidationError extends Error {
  constructor(issues) {
    super(`Shortcut workspace validation failed: ${issues.join('; ')}`);
    this.name = 'ShortcutWorkspaceValidationError';
    this.issues = Object.freeze([...issues]);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function rejectUnknownKeys(value, allowed, path, issues) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(`${path}.${key} is not allowed`);
  }
}

function requireSlotId(value, path, issues) {
  if (typeof value !== 'string' || !SLOT_ID_RE.test(value)) issues.push(`${path} is invalid`);
}

function resolveVariant(shortcut, requestedVariantId, path, issues) {
  const fallback = shortcut?.variants?.[0]?.id;
  const variantId = requestedVariantId === undefined ? fallback : requestedVariantId;
  if (typeof variantId !== 'string' || !shortcut?.variants?.some((variant) => variant.id === variantId)) {
    issues.push(`${path} must reference a variant on the shortcut`);
    return fallback || '';
  }
  return variantId;
}

function normalizeRawInputs(entry, rawInputs, path, issues) {
  const inputs = rawInputs === undefined ? {} : rawInputs;
  if (!isPlainObject(inputs)) {
    issues.push(`${path} must be an object`);
    return {};
  }

  for (const key of Object.keys(inputs)) {
    if (!INPUT_KEYS.has(key)) issues.push(`${path}.${key} is not supported`);
    if (!entry.requiredInputs.includes(key)) issues.push(`${path}.${key} is not allowed for ${entry.spellId}`);
  }

  const normalized = {};
  for (const required of entry.requiredInputs) {
    const value = inputs[required];
    if (!Number.isInteger(value) || value < -100 || value > 100) {
      issues.push(`${path}.${required} must be an integer from -100 to 100`);
    } else {
      normalized[required] = value;
    }
  }
  return normalized;
}

function normalizeRawSlot(slot, path, issues) {
  rejectUnknownKeys(slot, RAW_SLOT_KEYS, path, issues);
  requireSlotId(slot.id, `${path}.id`, issues);
  if (slot.source !== 'raw') issues.push(`${path}.source must be raw`);
  if (!RAW_RULESETS.includes(slot.ruleset)) issues.push(`${path}.ruleset is invalid`);
  if (typeof slot.spellId !== 'string' || !SLOT_ID_RE.test(slot.spellId)) issues.push(`${path}.spellId is invalid`);

  let entry = null;
  if (RAW_RULESETS.includes(slot.ruleset) && typeof slot.spellId === 'string') {
    try {
      entry = getRawSpell(slot.ruleset, slot.spellId);
    } catch {
      entry = null;
    }
  }
  if (!entry) {
    issues.push(`${path} must reference a verified RAW catalog spell`);
    return null;
  }

  const icon = slot.icon === undefined ? entry.shortcut.icon : slot.icon;
  if (!BUILTIN_ICON_IDS.includes(icon)) issues.push(`${path}.icon must use a curated built-in icon`);
  const baseVariantId = resolveVariant(entry.shortcut, slot.baseVariantId, `${path}.baseVariantId`, issues);
  const inputs = normalizeRawInputs(entry, slot.inputs, `${path}.inputs`, issues);

  return {
    id: slot.id,
    source: 'raw',
    ruleset: entry.ruleset,
    spellId: entry.spellId,
    icon,
    baseVariantId,
    inputs,
  };
}

function normalizeFlexSlot(slot, path, issues) {
  rejectUnknownKeys(slot, FLEX_SLOT_KEYS, path, issues);
  requireSlotId(slot.id, `${path}.id`, issues);
  if (slot.source !== 'flex') issues.push(`${path}.source must be flex`);

  let definition = null;
  try {
    definition = createFlexShortcut(slot.definition);
  } catch (error) {
    const childIssues = Array.isArray(error?.issues) ? error.issues : [error?.message || 'definition is invalid'];
    childIssues.forEach((issue) => issues.push(`${path}.definition: ${issue}`));
  }
  if (!definition) return null;

  const icon = slot.icon === undefined ? definition.icon : slot.icon;
  if (!BUILTIN_ICON_IDS.includes(icon)) issues.push(`${path}.icon must use a curated built-in icon`);
  const baseVariantId = resolveVariant(definition, slot.baseVariantId, `${path}.baseVariantId`, issues);

  return {
    id: slot.id,
    source: 'flex',
    icon,
    baseVariantId,
    definition,
  };
}

export function normalizeShortcutOptions(value = DEFAULT_SHORTCUT_OPTIONS) {
  const issues = [];
  const options = value === undefined || value === null ? DEFAULT_SHORTCUT_OPTIONS : value;
  if (!isPlainObject(options)) {
    throw new ShortcutWorkspaceValidationError(['options must be an object']);
  }
  rejectUnknownKeys(options, OPTION_KEYS, 'options', issues);

  const criticalMode = options.criticalMode ?? DEFAULT_SHORTCUT_OPTIONS.criticalMode;
  const preferredRuleset = options.preferredRuleset ?? DEFAULT_SHORTCUT_OPTIONS.preferredRuleset;
  if (!SHORTCUT_CRITICAL_MODES.includes(criticalMode)) issues.push('options.criticalMode is invalid');
  if (!SHORTCUT_RULESET_PREFERENCES.includes(preferredRuleset)) issues.push('options.preferredRuleset is invalid');
  if (issues.length) throw new ShortcutWorkspaceValidationError(issues);

  return deepFreeze({ criticalMode, preferredRuleset });
}

export function normalizeShortcutSlots(shortcuts) {
  const issues = [];
  if (!Array.isArray(shortcuts)) throw new ShortcutWorkspaceValidationError(['shortcuts must be an array']);
  if (shortcuts.length > MAX_SHORTCUTS) issues.push(`shortcuts cannot exceed ${MAX_SHORTCUTS} entries`);

  const ids = new Set();
  const normalized = [];
  shortcuts.slice(0, MAX_SHORTCUTS).forEach((slot, index) => {
    const path = `shortcuts[${index}]`;
    if (!isPlainObject(slot)) {
      issues.push(`${path} must be an object`);
      return;
    }
    if (!SHORTCUT_SLOT_SOURCES.includes(slot.source)) {
      issues.push(`${path}.source is invalid`);
      return;
    }
    if (typeof slot.id === 'string') {
      if (ids.has(slot.id)) issues.push(`${path}.id must be unique`);
      ids.add(slot.id);
    }
    const value = slot.source === 'raw'
      ? normalizeRawSlot(slot, path, issues)
      : normalizeFlexSlot(slot, path, issues);
    if (value) normalized.push(value);
  });

  if (issues.length) throw new ShortcutWorkspaceValidationError(issues);
  return deepFreeze(structuredClone(normalized));
}

export function createStoredShortcutWorkspace(shortcuts, {
  revision = 0,
  updatedAt = null,
  options = DEFAULT_SHORTCUT_OPTIONS,
} = {}) {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new ShortcutWorkspaceValidationError(['revision must be a non-negative integer']);
  }
  if (updatedAt !== null && (typeof updatedAt !== 'string' || Number.isNaN(Date.parse(updatedAt)))) {
    throw new ShortcutWorkspaceValidationError(['updatedAt must be null or an ISO date string']);
  }
  return deepFreeze({
    schemaVersion: SHORTCUT_WORKSPACE_SCHEMA_VERSION,
    revision,
    updatedAt,
    shortcuts: normalizeShortcutSlots(shortcuts),
    options: normalizeShortcutOptions(options),
  });
}

export function validateStoredShortcutWorkspace(value) {
  const issues = [];
  if (!isPlainObject(value)) throw new ShortcutWorkspaceValidationError(['stored workspace must be an object']);

  const sourceVersion = value.schemaVersion;
  if (sourceVersion !== 1 && sourceVersion !== SHORTCUT_WORKSPACE_SCHEMA_VERSION) {
    issues.push(`workspace.schemaVersion must be 1 or ${SHORTCUT_WORKSPACE_SCHEMA_VERSION}`);
  }
  rejectUnknownKeys(
    value,
    sourceVersion === 1 ? STORED_V1_KEYS : STORED_KEYS,
    'workspace',
    issues,
  );
  if (!Number.isInteger(value.revision) || value.revision < 0) {
    issues.push('workspace.revision must be a non-negative integer');
  }
  if (value.updatedAt !== null && (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt)))) {
    issues.push('workspace.updatedAt must be null or an ISO date string');
  }

  let shortcuts = [];
  try {
    shortcuts = normalizeShortcutSlots(value.shortcuts);
  } catch (error) {
    if (Array.isArray(error?.issues)) error.issues.forEach((issue) => issues.push(issue));
    else issues.push(error?.message || 'workspace.shortcuts is invalid');
  }

  let options = DEFAULT_SHORTCUT_OPTIONS;
  try {
    options = sourceVersion === 1
      ? DEFAULT_SHORTCUT_OPTIONS
      : normalizeShortcutOptions(value.options);
  } catch (error) {
    if (Array.isArray(error?.issues)) error.issues.forEach((issue) => issues.push(issue));
    else issues.push(error?.message || 'workspace.options is invalid');
  }
  if (issues.length) throw new ShortcutWorkspaceValidationError(issues);

  return deepFreeze({
    schemaVersion: SHORTCUT_WORKSPACE_SCHEMA_VERSION,
    revision: value.revision,
    updatedAt: value.updatedAt,
    shortcuts,
    options: normalizeShortcutOptions(options),
  });
}

export function createEmptyShortcutWorkspace() {
  return createStoredShortcutWorkspace([], {
    revision: 0,
    updatedAt: null,
    options: DEFAULT_SHORTCUT_OPTIONS,
  });
}

export function hydrateShortcutSlot(slot) {
  const [normalized] = normalizeShortcutSlots([slot]);
  if (normalized.source === 'raw') {
    const entry = getRawSpell(normalized.ruleset, normalized.spellId);
    return deepFreeze({ ...structuredClone(normalized), definition: structuredClone(entry.shortcut) });
  }
  return deepFreeze(structuredClone(normalized));
}
