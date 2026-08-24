import { rm } from 'node:fs/promises';

function processHasExited(child) {
  return child.exitCode != null || child.signalCode != null;
}

async function waitForProcessExit(child, timeoutMs) {
  if (processHasExited(child)) return true;
  return new Promise((resolvePromise) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off('exit', onExit);
      resolvePromise(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(processHasExited(child)), timeoutMs);
    child.once('exit', onExit);
  });
}

export async function stopChildProcess(child) {
  try {
    if (processHasExited(child)) return;
    child.kill('SIGTERM');
    if (await waitForProcessExit(child, 1200)) return;
    child.kill('SIGKILL');
    await waitForProcessExit(child, 1200);
  } catch (error) {
    console.error('Failed to stop browser process:', error);
    throw error;
  }
}

export async function removeTempDirectory(path) {
  try {
    await rm(path, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch (error) {
    console.error(`Failed to remove browser profile ${path}:`, error);
    throw error;
  }
}
