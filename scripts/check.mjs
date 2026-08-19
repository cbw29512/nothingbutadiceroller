import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

async function listCodeFiles(directory, extensions) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => resolve(root, directory, entry.name));
}

async function checkFile(path) {
  try {
    await execFileAsync(process.execPath, ['--check', path]);
  } catch (error) {
    console.error(`Syntax check failed: ${path}`);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

try {
  const browserFiles = await listCodeFiles('js', ['.js', '.mjs']);
  const functionFiles = await listCodeFiles('netlify/functions', ['.js', '.mjs']);
  const scriptFiles = await listCodeFiles('scripts', ['.js', '.mjs']);
  const files = [...browserFiles, ...functionFiles, ...scriptFiles]
    .filter((path) => !path.endsWith('check.mjs'));

  await Promise.all(files.map(checkFile));
  console.log(`Syntax checks passed for ${files.length} files.`);
} catch (error) {
  console.error('Pre-deploy checks failed.');
  process.exitCode = 1;
}
