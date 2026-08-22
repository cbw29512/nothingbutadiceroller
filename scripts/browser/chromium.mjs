import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import net from 'node:net';
import { CdpClient } from './cdp-client.mjs';

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function freePort() {
  return await new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolvePromise(port));
    });
  });
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const command of candidates) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return command;
  }
  throw new Error(`Chrome/Chromium was not found. Tried: ${candidates.join(', ')}`);
}

async function waitForDebugger(port, child, stderr) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find((item) => item.type === 'page');
        if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
      }
    } catch {
      // Browser is still starting.
    }
    if (child.exitCode != null) {
      throw new Error(`Browser exited before DevTools was ready (${child.exitCode}). ${stderr()}`);
    }
    await sleep(100);
  }
  throw new Error(`Browser DevTools endpoint did not become ready. ${stderr()}`);
}

export async function launchBrowser() {
  const command = findBrowser();
  const port = await freePort();
  const profile = await mkdtemp(resolve(tmpdir(), 'dice-browser-smoke-'));
  let stderrText = '';
  const child = spawn(command, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', (chunk) => { stderrText += String(chunk); });
  const recentStderr = () => stderrText.slice(-3000);

  try {
    const websocketUrl = await waitForDebugger(port, child, recentStderr);
    const client = new CdpClient(websocketUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    return {
      command,
      client,
      async close() {
        client.close();
        if (child.exitCode == null) child.kill('SIGTERM');
        await sleep(150);
        if (child.exitCode == null) child.kill('SIGKILL');
        await rm(profile, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (child.exitCode == null) child.kill('SIGKILL');
    await rm(profile, { recursive: true, force: true });
    throw error;
  }
}

export async function waitFor(client, expression, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await client.evaluate(`Boolean(${expression})`)) return true;
    await sleep(75);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

export async function navigate(client, url, viewport) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width, height: viewport.height,
    screenWidth: viewport.width, screenHeight: viewport.height,
    deviceScaleFactor: 1, mobile: Boolean(viewport.mobile),
  });
  await client.send('Emulation.setTouchEmulationEnabled', {
    enabled: Boolean(viewport.mobile), maxTouchPoints: viewport.mobile ? 5 : 1,
  });
  const navigation = await client.send('Page.navigate', { url });
  if (navigation.errorText) throw new Error(`Browser navigation failed for ${url}: ${navigation.errorText}`);
  await waitFor(
    client,
    `location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`,
    10000,
  );
}
