import { copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const dist = resolve('dist');

try {
  const files = await readdir(root);
  const verificationFiles = files.filter(name => /^google[a-z0-9_-]+\.html$/i.test(name));

  for (const name of verificationFiles) {
    await copyFile(resolve(root, name), resolve(dist, name));
  }

  console.log(`Google verification files copied: ${verificationFiles.length}`);
} catch (error) {
  console.error('Google verification file copy failed:', error);
  process.exitCode = 1;
}
