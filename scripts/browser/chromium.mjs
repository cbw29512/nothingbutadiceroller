import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { CdpClient } from './cdp-client.mjs';
import { removeTempDirectory, stopChildProcess } from './process-cleanup.mjs';

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

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

function devToolsPort(stderrText) {
  const match = stderrText.match(/DevTools listening on ws:\/\/[^:\s]+:(\d+)\/devtools\/browser\//);
  return match ? Number(match[1]) : null;
}

async function waitForDebugger(child, stderr) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode != null) {
      throw new Error(`Browser exited before DevTools was ready (${child.exitCode}). ${stderr()}`);
    }
    const port = devToolsPort(stderr());
    if (port) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (response.ok) {
          const targets = await response.json();
          const target = targets.find((item) => item.type === 'page');
          if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
        }
      } catch {
        // DevTools announced the endpoint but the target is still starting.
      }
    }
    await sleep(100);
  }
  throw new Error(`Browser DevTools endpoint did not become ready. ${stderr()}`);
}

export async function launchBrowser() {
  const command = findBrowser();
  const profile = await mkdtemp(resolve(tmpdir(), 'dice-browser-smoke-'));
  let stderrText = '';
  const child = spawn(command, [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', (chunk) => { stderrText += String(chunk); });
  const recentStderr = () => stderrText.slice(-5000);

  try {
    const websocketUrl = await waitForDebugger(child, recentStderr);
    const client = new CdpClient(websocketUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    return {
      command,
      client,
      async close() {
        try {
          client.close();
        } finally {
          await stopChildProcess(child);
          await removeTempDirectory(profile);
        }
      },
    };
  } catch (error) {
    try {
      await stopChildProcess(child);
      await removeTempDirectory(profile);
    } catch (cleanupError) {
      console.warn('Browser launch cleanup failed:', cleanupError.message);
    }
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
