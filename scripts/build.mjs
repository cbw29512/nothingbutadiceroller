import { access, cp, mkdir, readFile, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');

const files = [
  'index.html',
  'styles.css',
  'themes.css',
  'account.css',
  'community.css',
  'mobile.css',
  'custom.css',
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
    for (const directory of directories) {
      await cp(resolve(root, directory), resolve(dist, directory), { recursive: true });
    }
  } catch (error) {
    console.error('Static site copy failed:', error);
    throw error;
  }
}

async function bundleBrowserApp() {
  try {
    await build({
      entryPoints: [resolve(root, 'js/app.js')],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      outfile: resolve(dist, 'js/app.js'),
      logLevel: 'warning',
    });
  } catch (error) {
    console.error('Browser app bundle failed:', error);
    throw error;
  }
}

async function validateBuild() {
  try {
    const required = [
      ...files,
      'js/app.js',
      'js/account.js',
      'js/account-api.js',
      'js/account-ui.js',
      'js/auth-ui.js',
      'js/custom-controls.js',
      'js/custom-roll.js',
      'js/deployment.js',
      'js/drawer-controls.js',
      'js/physics.js',
      'js/roll-results.js',
      'js/roller.js',
      'js/style-picker.js',
      'js/theme-community.js',
      'js/tray-controls.js',
      'js/shortcut-harness.js',
      'js/shortcuts/icons.mjs',
      'js/shortcuts/toolbar.mjs',
    ];

    await Promise.all(required.map(path => access(resolve(dist, path))));

    const html = await readFile(resolve(dist, 'index.html'), 'utf8');
    const harnessHtml = await readFile(resolve(dist, 'shortcut-harness.html'), 'utf8');
    const browserApp = await readFile(resolve(dist, 'js/app.js'), 'utf8');
    const accountApi = await readFile(resolve(dist, 'js/account-api.js'), 'utf8');
    const authUi = await readFile(resolve(dist, 'js/auth-ui.js'), 'utf8');
    const customControls = await readFile(resolve(dist, 'js/custom-controls.js'), 'utf8');
    const customRoll = await readFile(resolve(dist, 'js/custom-roll.js'), 'utf8');
    const trayControls = await readFile(resolve(dist, 'js/tray-controls.js'), 'utf8');

    const expectedHtml = [
      'href="/styles.css"',
      'href="/themes.css"',
      'href="/account.css"',
      'href="/mobile.css"',
      'href="/community.css"',
      'href="/custom.css"',
      'src="/js/app.js"',
      'id="desktop-custom-die-btn"',
      'popovertarget="desktop-custom-die-popover"',
      'id="desktop-custom-die-popover"',
      'popover="auto"',
      '>CUSTOM</button>',
      'Keep dice after roll',
      'id="tray-roll-hint"',
      'CLICK / TAP TRAY TO ROLL',
      'SECURE RANDOMIZATION ENGINE',
      'Physics-resolved dice • Cryptographic custom rolls',
    ];

    for (const reference of expectedHtml) {
      if (!html.includes(reference)) {
        throw new Error(`Missing completed UI reference: ${reference}`);
      }
    }

    const expectedHarness = [
      'name="robots" content="noindex,nofollow"',
      'href="/shortcut-toolbar.css"',
      'href="/shortcut-harness.css"',
      'id="shortcut-toolbar-harness"',
      'src="/js/shortcut-harness.js"',
    ];
    for (const reference of expectedHarness) {
      if (!harnessHtml.includes(reference)) {
        throw new Error(`Missing Phase 4 harness reference: ${reference}`);
      }
    }
    if (html.includes('shortcut-toolbar.css') || html.includes('shortcut-toolbar-harness')) {
      throw new Error('Phase 4 shortcut toolbar must remain disconnected from the live roller.');
    }

    const expectedCustomControls = [
      'supportsNativePopover',
      'showPopover()',
      'hidePopover()',
      "addEventListener('toggle'",
    ];
    for (const reference of expectedCustomControls) {
      if (!customControls.includes(reference)) {
        throw new Error(`Missing resilient custom-control behavior: ${reference}`);
      }
    }

    const expectedCustomRoll = [
      'crypto.getRandomValues',
      'SECURE CUSTOM ROLL',
      'Web Crypto CSPRNG',
      'MAX_CUSTOM_SIDES = 1_000_000',
    ];
    for (const reference of expectedCustomRoll) {
      if (!customRoll.includes(reference)) {
        throw new Error(`Missing secure custom-roll feature: ${reference}`);
      }
    }

    const expectedTrayControls = [
      "tray.addEventListener('click'",
      "['Enter', ' ']",
      'canRollFromTray',
    ];
    for (const reference of expectedTrayControls) {
      if (!trayControls.includes(reference)) {
        throw new Error(`Missing tray-roll feature: ${reference}`);
      }
    }

    const expectedIdentitySource = [
      'handleAuthCallback',
      'processIdentityCallback',
      'onAuthChange',
    ];
    for (const reference of expectedIdentitySource) {
      if (!accountApi.includes(reference) && !authUi.includes(reference)) {
        throw new Error(`Missing browser Identity callback behavior: ${reference}`);
      }
    }

    if (browserApp.includes("from '@netlify/identity'")) {
      throw new Error('Browser bundle must not ship an unresolved @netlify/identity import.');
    }

    if (html.includes('netlify-identity-widget')) {
      throw new Error('Legacy Netlify Identity widget must not ship in production.');
    }

    console.log('Build validation passed:', required.join(', '));
  } catch (error) {
    console.error('Build validation failed:', error);
    throw error;
  }
}

try {
  await copySite();
  await bundleBrowserApp();
  await validateBuild();
  console.log(`Static site ready at ${dist}`);
} catch (error) {
  console.error('Build aborted:', error);
  process.exitCode = 1;
}
