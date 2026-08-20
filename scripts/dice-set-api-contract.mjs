import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

try {
  const [saveApi, libraryApi, cloudRules] = await Promise.all([
    read('netlify/functions/save-dice-set.mjs'),
    read('netlify/functions/dice-sets.mjs'),
    read('js/appearance/cloud-rules.mjs'),
  ]);
  ['const user = await getUser()', 'if (!user)', 'prepareCloudDiceSet(body?.set, user.id)', 'assertLockedUpdateAllowed(existing.set, set)', "set.visibility === 'public' && set.locked"]
    .forEach((text) => requireText(saveApi, text, 'save API protection'));
  ['const user = await getUser()', "scope === 'community'", "record?.set?.locked && record?.set?.visibility === 'public'", 'recordKey(user.id, setId)', 'ownerId !== user.id && !publicLocked']
    .forEach((text) => requireText(libraryApi, text, 'library API protection'));
  ['set.ownerId = userId', "set.id === SYSTEM_DEFAULT_DICE_SET_ID", 'MAX_CLOUD_SET_BYTES', 'Unlock the dice set before changing its name or appearance.']
    .forEach((text) => requireText(cloudRules, text, 'cloud rule'));
  console.log('Dice-set API contract passed: auth ownership, locked mutation guard, public-read boundary, and system-default protection.');
} catch (error) {
  console.error('Dice-set API contract failed:', error);
  process.exitCode = 1;
}
