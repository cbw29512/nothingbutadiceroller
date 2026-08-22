import { access, cp, mkdir, readFile, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');

const files = [
  'index.html',
  'customize.html',
  'appearance-harness.html',
  'rolls.html',
  'styles.css',
  'customize.css',
  'appearance-harness.css',
  'themes.css',
  'account.css',
  'community.css',
  'mobile.css',
  'custom.css',
  'rolls.css',
  'shortcut-harness.html',
  'shortcut-toolbar.css',
  'shortcut-harness.css',
];
const directories = ['js'];

async function copySite() {
  try {
    await rm(dist, { recursive: true, force: true });
    await mkdir(dist, { recursive: true });
    for (const file of files) await copyFile(resolve(root, file), resolve(dist, file));
    for (const directory of directories) await cp(resolve(root, directory), resolve(dist, directory), { recursive: true });
  } catch (error) {
    console.error('Static site copy failed:', error);
    throw error;
  }
}

async function bundleBrowserApps() {
  try {
    await build({
      entryPoints: { app: resolve(root, 'js/app.js'), rolls: resolve(root, 'js/rolls.js') },
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      outdir: resolve(dist, 'js'),
      entryNames: '[name]',
      logLevel: 'warning',
    });
  } catch (error) {
    console.error('Browser app bundle failed:', error);
    throw error;
  }
}

function requireReferences(source, references, label) {
  for (const reference of references) {
    if (!source.includes(reference)) throw new Error(`Missing ${label}: ${reference}`);
  }
}

async function validateBuild() {
  try {
    const required = [
      ...files,
      'js/app.js', 'js/rolls.js', 'js/account.js', 'js/account-api.js', 'js/account-ui.js', 'js/auth-ui.js',
      'js/custom-controls.js', 'js/custom-roll.js', 'js/deployment.js', 'js/drawer-controls.js', 'js/physics.js',
      'js/roll-results.js', 'js/roller.js', 'js/style-picker.js', 'js/theme-community.js', 'js/tray-controls.js',
      'js/shortcut-harness.js', 'js/appearance/studio.js', 'js/appearance/studio-persistence.mjs',
      'js/appearance/studio-render.mjs', 'js/appearance/dicebox-proof-harness.js', 'js/appearance/runtime-theme-codec.mjs',
      'js/shortcuts/icons.mjs', 'js/shortcuts/manager-state.mjs', 'js/shortcuts/persistence.mjs', 'js/shortcuts/toolbar.mjs',
    ];
    await Promise.all(required.map(path => access(resolve(dist, path))));

    const [html, studioHtml, appearanceHarnessHtml, rollsHtml, harnessHtml, browserApp, browserRolls, accountApi, authUi, customControls, customRoll, trayControls, appearanceProof] = await Promise.all([
      readFile(resolve(dist, 'index.html'), 'utf8'), readFile(resolve(dist, 'customize.html'), 'utf8'),
      readFile(resolve(dist, 'appearance-harness.html'), 'utf8'), readFile(resolve(dist, 'rolls.html'), 'utf8'),
      readFile(resolve(dist, 'shortcut-harness.html'), 'utf8'), readFile(resolve(dist, 'js/app.js'), 'utf8'),
      readFile(resolve(dist, 'js/rolls.js'), 'utf8'), readFile(resolve(dist, 'js/account-api.js'), 'utf8'),
      readFile(resolve(dist, 'js/auth-ui.js'), 'utf8'), readFile(resolve(dist, 'js/custom-controls.js'), 'utf8'),
      readFile(resolve(dist, 'js/custom-roll.js'), 'utf8'), readFile(resolve(dist, 'js/tray-controls.js'), 'utf8'),
      readFile(resolve(dist, 'js/appearance/dicebox-proof-harness.js'), 'utf8'),
    ]);

    requireReferences(html, [
      'href="/styles.css"', 'href="/themes.css"', 'href="/account.css"', 'href="/mobile.css"',
      'href="/community.css"', 'href="/custom.css"', 'src="/js/app.js"', 'id="desktop-custom-die-btn"',
      'popovertarget="desktop-custom-die-popover"', 'id="desktop-custom-die-popover"', 'popover="auto"',
      '>CUSTOM</button>', 'Keep dice after roll', 'id="tray-roll-hint"', 'CLICK / TAP TRAY TO ROLL',
      'SECURE RANDOMIZATION ENGINE', 'Physics-resolved dice • Cryptographic custom rolls',
    ], 'completed UI reference');

    requireReferences(studioHtml, [
      'DICE & TRAY STUDIO', 'id="studio-library"', 'id="studio-preview-tray"', 'id="reset-default"',
      'id="lock-set"', 'RAW — standard numbers', 'src="/js/appearance/studio.js"',
    ], 'Dice Studio reference');

    requireReferences(appearanceHarnessHtml, [
      'name="robots" content="noindex,nofollow"', 'ISOLATED V2 PROOF', 'id="appearance-proof-tray"',
      'id="proof-roll-one"', 'id="proof-roll-ten"', 'src="/js/appearance/dicebox-proof-harness.js"',
    ], 'appearance proof harness reference');
    requireReferences(appearanceProof, [
      'CUSTOM_FACE_MODE', "result === 20", "value === 20 ? '☠' : '1'", 'externalThemes:',
      'gravity: 1', 'mass: 1', 'friction: 0.8', 'throwForce: 5',
    ], 'isolated appearance proof behavior');

    requireReferences(rollsHtml, [
      'name="robots" content="noindex,nofollow"', 'href="/rolls.css"', 'href="/shortcut-toolbar.css"',
      'id="manager-toolbar"', 'data-tab="2024"', 'data-tab="2014"', 'data-tab="homebrew"', 'data-tab="options"',
      'id="duplicate-shortcut"', 'id="validate-homebrew"', 'id="reset-shortcuts"', 'id="preferred-ruleset"',
      'src="/js/rolls.js"',
    ], 'Phase 7 manager reference');

    requireReferences(harnessHtml, [
      'name="robots" content="noindex,nofollow"', 'href="/shortcut-toolbar.css"', 'href="/shortcut-harness.css"',
      'id="shortcut-toolbar-harness"', 'src="/js/shortcut-harness.js"',
    ], 'Phase 4 harness reference');

    if (html.includes('shortcut-toolbar.css') || html.includes('shortcut-toolbar-harness')) throw new Error('Base HTML must keep shortcut UI as progressive enhancement.');
    if (html.includes('studio-preview-tray') || html.includes('DICE & TRAY STUDIO') || html.includes('appearance-proof-tray')) {
      throw new Error('Advanced Dice Studio and proof harness must remain off the landing page.');
    }

    requireReferences(customControls, ['supportsNativePopover', 'showPopover()', 'hidePopover()', "addEventListener('toggle'"], 'resilient custom-control behavior');
    requireReferences(customRoll, ['crypto.getRandomValues', 'SECURE CUSTOM ROLL', 'Web Crypto CSPRNG', 'MAX_CUSTOM_SIDES = 1_000_000'], 'secure custom-roll feature');
    requireReferences(trayControls, ["tray.addEventListener('click'", "['Enter', ' ']", 'canRollFromTray'], 'tray-roll feature');

    for (const reference of ['handleAuthCallback', 'processIdentityCallback', 'onAuthChange']) {
      if (!accountApi.includes(reference) && !authUi.includes(reference)) throw new Error(`Missing browser Identity callback behavior: ${reference}`);
    }
    if (browserApp.includes("from '@netlify/identity'") || browserRolls.includes("from '@netlify/identity'")) throw new Error('Browser bundles must not ship an unresolved @netlify/identity import.');
    if (html.includes('netlify-identity-widget') || rollsHtml.includes('netlify-identity-widget')) throw new Error('Legacy Netlify Identity widget must not ship.');

    console.log('Build validation passed:', required.join(', '));
  } catch (error) {
    console.error('Build validation failed:', error);
    throw error;
  }
}

try {
  await copySite();
  await bundleBrowserApps();
  await validateBuild();
  console.log(`Static site ready at ${dist}`);
} catch (error) {
  console.error('Build aborted:', error);
  process.exitCode = 1;
}
