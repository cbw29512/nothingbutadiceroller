import { readFile } from 'node:fs/promises';

async function read(path) { return readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(source, text, label) { if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`); }

try {
  const [saveApi, libraryApi, cloudRules, imageApi] = await Promise.all([
    read('netlify/functions/save-dice-set.mjs'), read('netlify/functions/dice-sets.mjs'),
    read('js/appearance/cloud-rules.mjs'), read('netlify/functions/dice-set-image.mjs'),
  ]);
  [
    'const user = await getUser()', 'if (!user)', 'const rawSet = structuredClone',
    'extractTrayImageDataUrl', 'prepareCloudDiceSet(rawSet, user.id)',
    'assertLockedUpdateAllowed(existing.set, set)', "set.visibility === 'public' && set.locked",
    'trayImageAccessToken', 'MAX_TRAY_IMAGE_BYTES',
  ].forEach((text) => requireText(saveApi, text, 'save API protection'));
  [
    'const user = await getUser()', "scope === 'community'",
    "record?.set?.locked && record?.set?.visibility === 'public'", 'recordKey(user.id, setId)',
    'ownerId !== user.id && !publicLocked', 'existing.trayImageKey',
  ].forEach((text) => requireText(libraryApi, text, 'library API protection'));
  ['set.ownerId = userId', "set.id === SYSTEM_DEFAULT_DICE_SET_ID", 'MAX_CLOUD_SET_BYTES', 'Unlock the dice set before changing its name or appearance.']
    .forEach((text) => requireText(cloudRules, text, 'cloud rule'));
  ["path: '/api/dice-set-image'", 'hasCapability', 'X-Content-Type-Options']
    .forEach((text) => requireText(imageApi, text, 'tray image API protection'));
  console.log('Dice-set API contract passed: auth ownership, locked mutation guard, public-read boundary, system-default protection, and capability-scoped tray images.');
} catch (error) {
  console.error('Dice-set API contract failed:', error);
  process.exitCode = 1;
}
