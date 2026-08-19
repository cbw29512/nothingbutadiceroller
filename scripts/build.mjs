import { access, cp, mkdir, readFile, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    ];

    await Promise.all(required.map(path => access(resolve(dist, path))));
    const html = await readFile(resolve(dist, 'index.html'), 'utf8');
    const expectedReferences = [
      'href="/styles.css"',
      'href="/themes.css"',
      'href="/account.css"',
      'href="/mobile.css"',
      'src="/js/app.js"',
      'id="tray-roll-hint"',
    ];
    for (const reference of expectedReferences) {
      if (!html.includes(reference)) throw new Error(`Missing build reference: ${reference}`);
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
  await validateBuild();
  console.log(`Static site ready at ${dist}`);
} catch (error) {
  console.error('Build aborted:', error);
  process.exitCode = 1;
}
