import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, navigate, waitFor } from './browser/chromium.mjs';
import { startBuiltSiteServer } from './browser/static-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const mobile = { name: 'mobile', width: 390, height: 844, mobile: true };
const desktop = { name: 'desktop', width: 1440, height: 900, mobile: false };
const guildUrl = 'https://lighttowertabletopguild.netlify.app/tools.html';

async function run() {
  await access(resolve(dist, 'index.html'));
  let server;
  let browser;
  try {
    server = await startBuiltSiteServer(dist);
    browser = await launchBrowser();
    const client = browser.client;

    await navigate(client, `${server.origin}/`, mobile);
    await waitFor(client, "document.querySelector('.mobile-header-more') && document.querySelector('.mobile-account-proxy') && document.querySelector('.mobile-guild-proxy')");
    const mobileState = await client.evaluate(`(() => {
      const visible = (element) => Boolean(element?.getClientRects().length) && getComputedStyle(element).display !== 'none';
      const top = [
        document.querySelector('#sound-toggle-btn'),
        document.querySelector('#open-styles-btn'),
        document.querySelector('#open-history-btn'),
        document.querySelector('.mobile-header-more > summary'),
      ];
      return {
        topVisible: top.map(visible),
        heights: top.map((element) => element?.getBoundingClientRect().height || 0),
        originalGuildVisible: visible(document.querySelector('a[href="${guildUrl}"]')),
        originalAccountVisible: visible(document.querySelector('#open-account-btn')),
        originalSupportVisible: visible(document.querySelector('#support-project-link')),
        moreVisible: visible(document.querySelector('.mobile-header-more')),
        desktopDice: document.querySelectorAll('.die-btn[data-type]').length,
        mobileDice: document.querySelectorAll('.mobile-die-btn[data-type]').length,
        trayPresent: Boolean(document.querySelector('#dice-tray')),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`);
    assert.deepEqual(mobileState.topVisible, [true, true, true, true], 'Mobile header must expose Sound, Dice Studio, History, and More.');
    assert.ok(mobileState.heights.every((height) => height >= 44), `Mobile header targets must be at least 44px: ${mobileState.heights.join(', ')}.`);
    assert.equal(mobileState.originalGuildVisible, false, 'Desktop Guild Tools link should move behind More on mobile.');
    assert.equal(mobileState.originalAccountVisible, false, 'Original account button should move behind More on mobile.');
    assert.equal(mobileState.originalSupportVisible, false, 'Original Support link should move behind More on mobile.');
    assert.equal(mobileState.moreVisible, true);
    assert.equal(mobileState.desktopDice, 7, 'Desktop dice selector must remain structurally intact.');
    assert.equal(mobileState.mobileDice, 7, 'Mobile dice selector must remain intact.');
    assert.equal(mobileState.trayPresent, true, 'Protected dice tray must remain present.');
    assert.ok(mobileState.overflow <= 1, `Mobile header introduced ${mobileState.overflow}px horizontal overflow.`);

    await client.evaluate("document.querySelector('.mobile-header-more > summary')?.click()");
    await waitFor(client, "document.querySelector('.mobile-header-more')?.open === true");
    const menu = await client.evaluate(`(() => ({
      account: document.querySelector('.mobile-account-proxy')?.textContent.trim() || '',
      accountHeight: document.querySelector('.mobile-account-proxy')?.getBoundingClientRect().height || 0,
      guild: document.querySelector('.mobile-guild-proxy')?.getAttribute('href') || '',
      guildHeight: document.querySelector('.mobile-guild-proxy')?.getBoundingClientRect().height || 0,
      howTo: document.querySelector('.mobile-header-menu a[href="/how-to.html"]')?.getAttribute('href') || '',
      support: document.querySelector('.mobile-support-proxy')?.getAttribute('href') || '',
      supportRel: document.querySelector('.mobile-support-proxy')?.getAttribute('rel') || '',
    }))()`);
    assert.match(menu.account, /Sign In|My Dice/i);
    assert.ok(menu.accountHeight >= 44, `Mobile account menu target is ${menu.accountHeight}px.`);
    assert.equal(menu.guild, guildUrl);
    assert.ok(menu.guildHeight >= 44, `Mobile Guild Tools target is ${menu.guildHeight}px.`);
    assert.equal(menu.howTo, '/how-to.html');
    assert.match(menu.support, /buymeacoffee\.com\/divclass016/);
    assert.match(menu.supportRel, /noopener/);

    await client.evaluate("document.querySelector('.mobile-account-proxy')?.click()");
    await waitFor(client, "document.querySelector('#account-drawer')?.getAttribute('aria-hidden') === 'false'");
    await waitFor(client, "document.activeElement?.id === 'close-account-btn'");
    assert.equal(await client.evaluate("document.querySelector('.mobile-header-more')?.open"), false, 'More menu must close when opening account.');
    await client.evaluate("document.querySelector('#close-account-btn')?.click()");
    await waitFor(client, "document.querySelector('#account-drawer')?.getAttribute('aria-hidden') === 'true'");
    await waitFor(client, "document.querySelector('.mobile-header-more')?.open === true");
    await waitFor(client, "document.activeElement?.classList.contains('mobile-account-proxy') === true");

    await client.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    await waitFor(client, "document.querySelector('.mobile-header-more')?.open === false");
    await waitFor(client, "document.activeElement === document.querySelector('.mobile-header-more > summary')");

    await navigate(client, `${server.origin}/`, desktop);
    await waitFor(client, "document.querySelector('.mobile-header-more')");
    const desktopState = await client.evaluate(`(() => {
      const visible = (element) => Boolean(element?.getClientRects().length) && getComputedStyle(element).display !== 'none';
      return {
        more: visible(document.querySelector('.mobile-header-more')),
        guild: visible(document.querySelector('a[href="${guildUrl}"]')),
        account: visible(document.querySelector('#open-account-btn')),
        support: visible(document.querySelector('#support-project-link')),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`);
    assert.equal(desktopState.more, false, 'Desktop header must not gain the mobile More menu.');
    assert.equal(desktopState.guild, true, 'Desktop Guild Tools link must stay visible.');
    assert.equal(desktopState.account, true, 'Desktop account button must stay visible.');
    assert.equal(desktopState.support, true, 'Desktop Support link must stay visible.');
    assert.ok(desktopState.overflow <= 1, `Desktop header introduced ${desktopState.overflow}px horizontal overflow.`);

    console.log('Mobile header passed: four primary controls, accessible More menu with Guild/Help/Support, account focus return, protected tray/toolbars intact, desktop Guild link preserved, and no horizontal overflow.');
  } finally {
    if (browser) await browser.close().catch((error) => console.warn('Browser cleanup failed:', error.message));
    if (server) await server.close().catch((error) => console.warn('Static server cleanup failed:', error.message));
  }
}

run().catch((error) => {
  console.error('Mobile header audit failed:', error);
  process.exitCode = 1;
});
