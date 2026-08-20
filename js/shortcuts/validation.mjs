import {
  BUILTIN_ICON_IDS,
  CRIT_POLICIES,
  GROUP_KINDS,
  MAX_DICE_COUNT,
  MAX_DICE_TERMS,
  MAX_GROUPS,
  MAX_MODIFIER,
  MAX_REPEAT,
  MAX_SHORTCUTS,
  RAW_RULESETS,
  ROLLER_DIE_SIDES,
  SHORTCUT_CATEGORIES,
  SHORTCUT_SCHEMA_VERSION,
  SHORTCUT_SOURCES,
} from './constants.mjs';

const TOP_LEVEL_KEYS = new Set(['schemaVersion', 'source', 'id', 'name', 'icon', 'category', 'ruleset', 'sourceRef', 'variants']);
const VARIANT_KEYS = new Set(['id', 'label', 'scaleRank', 'groups']);
const GROUP_KEYS = new Set(['id', 'label', 'kind', 'damageType', 'repeat', 'terms', 'modifier', 'crit']);
const TERM_KEYS = new Set(['count', 'sides']);
const CRIT_KEYS = new Set(['policy', 'triggerGroupId']);
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export class ShortcutValidationError extends Error {
  constructor(issues) {
    super(`Shortcut validation failed: ${issues.join('; ')}`);
    this.name = 'ShortcutValidationError';
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

function requireString(value, path, issues, { min = 1, max = 80, id = false } = {}) {
  if (typeof value !== 'string') {
    issues.push(`${path} must be text`);
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) issues.push(`${path} must be ${min}-${max} characters`);
  if (CONTROL_RE.test(value)) issues.push(`${path} contains control characters`);
  if (id && !ID_RE.test(trimmed)) issues.push(`${path} must use lowercase letters, numbers, and hyphens only`);
}

function requireInteger(value, path, issues, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) issues.push(`${path} must be an integer from ${min} to ${max}`);
}

function validateTerm(term, path, issues) {
  if (!isPlainObject(term)) {
    issues.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(term, TERM_KEYS, path, issues);
  requireInteger(term.count, `${path}.count`, issues, 1, MAX_DICE_COUNT);
  if (!Number.isInteger(term.sides) || !ROLLER_DIE_SIDES.includes(term.sides)) {
    issues.push(`${path}.sides must be one of ${ROLLER_DIE_SIDES.join(', ')}`);
  }
}

function validateCrit(crit, group, groupIds, path, issues) {
  if (!isPlainObject(crit)) {
    issues.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(crit, CRIT_KEYS, path, issues);
  if (!CRIT_POLICIES.includes(crit.policy)) issues.push(`${path}.policy is invalid`);
  if (crit.policy === 'double-dice') {
    requireString(crit.triggerGroupId, `${path}.triggerGroupId`, issues, { max: 64, id: true });
    if (typeof crit.triggerGroupId === 'string' && !groupIds.has(crit.triggerGroupId)) {
      issues.push(`${path}.triggerGroupId must reference a group in the same variant`);
    }
    if (group.kind !== 'damage') issues.push(`${path}.double-dice is only valid for damage groups`);
  } else if (crit.triggerGroupId !== undefined) {
    issues.push(`${path}.triggerGroupId is only allowed with double-dice`);
  }
}

function validateGroup(group, path, issues, groupIds) {
  if (!isPlainObject(group)) {
    issues.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(group, GROUP_KEYS, path, issues);
  requireString(group.id, `${path}.id`, issues, { max: 64, id: true });
  requireString(group.label, `${path}.label`, issues, { max: 80 });
  if (!GROUP_KINDS.includes(group.kind)) issues.push(`${path}.kind is invalid`);
  if (group.damageType !== undefined) requireString(group.damageType, `${path}.damageType`, issues, { max: 40 });
  requireInteger(group.repeat, `${path}.repeat`, issues, 1, MAX_REPEAT);
  requireInteger(group.modifier, `${path}.modifier`, issues, -MAX_MODIFIER, MAX_MODIFIER);

  if (!Array.isArray(group.terms) || group.terms.length < 1 || group.terms.length > MAX_DICE_TERMS) {
    issues.push(`${path}.terms must contain 1-${MAX_DICE_TERMS} dice terms`);
  } else {
    group.terms.forEach((term, index) => validateTerm(term, `${path}.terms[${index}]`, issues));
  }

  if (group.kind === 'damage' && typeof group.damageType !== 'string') issues.push(`${path}.damageType is required for damage groups`);
  if (group.kind !== 'damage' && group.damageType !== undefined) issues.push(`${path}.damageType is only valid for damage groups`);
  validateCrit(group.crit, group, groupIds, `${path}.crit`, issues);
}

function rollSignature(variant) {
  return JSON.stringify((variant.groups || []).map((group) => ({
    kind: group.kind,
    damageType: group.damageType || null,
    repeat: group.repeat,
    terms: group.terms,
    modifier: group.modifier,
    crit: group.crit,
  })));
}

function validateVariant(variant, path, issues) {
  if (!isPlainObject(variant)) {
    issues.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(variant, VARIANT_KEYS, path, issues);
  requireString(variant.id, `${path}.id`, issues, { max: 64, id: true });
  requireString(variant.label, `${path}.label`, issues, { max: 40 });
  requireInteger(variant.scaleRank, `${path}.scaleRank`, issues, 0, 99);

  if (!Array.isArray(variant.groups) || variant.groups.length < 1 || variant.groups.length > MAX_GROUPS) {
    issues.push(`${path}.groups must contain 1-${MAX_GROUPS} groups`);
    return;
  }

  const groupIds = new Set();
  for (const [index, group] of variant.groups.entries()) {
    if (typeof group?.id === 'string') {
      if (groupIds.has(group.id)) issues.push(`${path}.groups[${index}].id must be unique within the variant`);
      groupIds.add(group.id);
    }
  }
  variant.groups.forEach((group, index) => validateGroup(group, `${path}.groups[${index}]`, issues, groupIds));

  for (const [index, group] of variant.groups.entries()) {
    if (group?.crit?.policy !== 'double-dice') continue;
    const trigger = variant.groups.find((candidate) => candidate.id === group.crit.triggerGroupId);
    if (trigger && trigger.kind !== 'attack') issues.push(`${path}.groups[${index}].crit trigger must reference an attack group`);
    if (trigger && trigger.repeat !== 1 && trigger.repeat !== group.repeat) {
      issues.push(`${path}.groups[${index}].repeat must match its critical trigger repeat, unless the trigger repeats once`);
    }
  }
}

export function collectShortcutIssues(definition, { expectedSource } = {}) {
  const issues = [];
  if (!isPlainObject(definition)) return ['shortcut must be an object'];
  rejectUnknownKeys(definition, TOP_LEVEL_KEYS, 'shortcut', issues);

  if (definition.schemaVersion !== SHORTCUT_SCHEMA_VERSION) issues.push(`shortcut.schemaVersion must be ${SHORTCUT_SCHEMA_VERSION}`);
  if (!SHORTCUT_SOURCES.includes(definition.source)) issues.push('shortcut.source is invalid');
  if (expectedSource && definition.source !== expectedSource) issues.push(`shortcut.source must be ${expectedSource}`);
  requireString(definition.id, 'shortcut.id', issues, { max: 64, id: true });
  requireString(definition.name, 'shortcut.name', issues, { max: 80 });
  if (!BUILTIN_ICON_IDS.includes(definition.icon)) issues.push('shortcut.icon must use a curated built-in icon');
  if (!SHORTCUT_CATEGORIES.includes(definition.category)) issues.push('shortcut.category is invalid');

  if (definition.source === 'raw') {
    if (!RAW_RULESETS.includes(definition.ruleset)) issues.push('shortcut.ruleset is required for RAW definitions');
    requireString(definition.sourceRef, 'shortcut.sourceRef', issues, { max: 120 });
  } else if (definition.source === 'flex') {
    if (definition.ruleset !== undefined) issues.push('shortcut.ruleset is not allowed for Flex definitions');
    if (definition.sourceRef !== undefined) issues.push('shortcut.sourceRef is not allowed for Flex definitions');
  }

  if (!Array.isArray(definition.variants) || definition.variants.length < 1 || definition.variants.length > 20) {
    issues.push('shortcut.variants must contain 1-20 variants');
  } else {
    const variantIds = new Set();
    let previousRank = -1;
    definition.variants.forEach((variant, index) => {
      validateVariant(variant, `shortcut.variants[${index}]`, issues);
      if (typeof variant?.id === 'string') {
        if (variantIds.has(variant.id)) issues.push(`shortcut.variants[${index}].id must be unique`);
        variantIds.add(variant.id);
      }
      if (Number.isInteger(variant?.scaleRank)) {
        if (variant.scaleRank <= previousRank) issues.push('shortcut variant scaleRank values must increase strictly');
        previousRank = variant.scaleRank;
      }
    });
  }

  return issues;
}

export function assertValidShortcut(definition, options = {}) {
  const issues = collectShortcutIssues(definition, options);
  if (issues.length) throw new ShortcutValidationError(issues);
  return definition;
}

export function validateShortcutCollection(shortcuts) {
  const issues = [];
  if (!Array.isArray(shortcuts)) issues.push('shortcut collection must be an array');
  else {
    if (shortcuts.length > MAX_SHORTCUTS) issues.push(`shortcut collection cannot exceed ${MAX_SHORTCUTS} entries`);
    const ids = new Set();
    shortcuts.forEach((shortcut, index) => {
      const childIssues = collectShortcutIssues(shortcut);
      childIssues.forEach((issue) => issues.push(`[${index}] ${issue}`));
      if (typeof shortcut?.id === 'string') {
        if (ids.has(shortcut.id)) issues.push(`[${index}] shortcut.id must be unique in the collection`);
        ids.add(shortcut.id);
      }
    });
  }
  if (issues.length) throw new ShortcutValidationError(issues);
  return shortcuts;
}

export function getRollSignature(variant) {
  return rollSignature(variant);
}
