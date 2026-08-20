export * from './catalog.mjs';
export * from './coverage.mjs';
export * from './helpers.mjs';
export { RAW_2014 } from './2014.mjs';
export { RAW_2024 } from './2024.mjs';

import { RAW_2014 } from './2014.mjs';
import { RAW_2024 } from './2024.mjs';
import { validateRawCatalog } from './catalog.mjs';
import { assertCoverageMatchesCatalog } from './coverage.mjs';

validateRawCatalog(RAW_2014, { ruleset: 'dnd5e-2014', srdVersion: '5.1' });
validateRawCatalog(RAW_2024, { ruleset: 'dnd5e-2024', srdVersion: '5.2.1' });
assertCoverageMatchesCatalog(RAW_2014, 'dnd5e-2014');
assertCoverageMatchesCatalog(RAW_2024, 'dnd5e-2024');

export const RAW_CATALOGS = Object.freeze({
  'dnd5e-2014': RAW_2014,
  'dnd5e-2024': RAW_2024,
});

const RAW_CATALOG_INDEXES = Object.freeze({
  'dnd5e-2014': Object.freeze(Object.fromEntries(RAW_2014.map((entry) => [entry.spellId, entry]))),
  'dnd5e-2024': Object.freeze(Object.fromEntries(RAW_2024.map((entry) => [entry.spellId, entry]))),
});

export function getRawCatalog(ruleset) {
  const catalog = RAW_CATALOGS[ruleset];
  if (!catalog) throw new Error(`Unknown RAW ruleset: ${ruleset}`);
  return catalog;
}

export function getRawSpell(ruleset, spellId) {
  const index = RAW_CATALOG_INDEXES[ruleset];
  if (!index) throw new Error(`Unknown RAW ruleset: ${ruleset}`);
  return index[spellId] || null;
}
