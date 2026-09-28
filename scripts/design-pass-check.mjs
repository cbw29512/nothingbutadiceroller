// Design pass checks (2026-09-27). Run: node scripts/design-pass-check.mjs (no dependencies).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AFFILIATE_CONFIG } from '../js/affiliate-config.js';
import { isRealAffiliateUrl, renderableGroups, renderAffiliateSlots } from '../js/affiliate-slots.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const BMC = 'https://buymeacoffee.com/divclass016';
let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); passed += 1; };

const [index, howTo, privacy, legal, css, sw, build, menu] = await Promise.all([
  read('index.html'), read('how-to.html'), read('privacy.html'), read('legal.html'),
  read('site-polish.css'), read('sw.js'), read('scripts/build.mjs'), read('js/mobile-header-menu.js'),
]);

// Header support links.
check(index.includes(`id="support-project-link" class="btn secondary support-link" href="${BMC}"`), 'Desktop header Support link kept.');
check(/class="btn secondary nbdr-bmc-mini" href="https:\/\/buymeacoffee\.com\/divclass016" target="_blank" rel="noopener noreferrer"/.test(index), 'Mobile header coffee link present.');
for (const [name, html] of [['how-to', howTo], ['privacy', privacy], ['legal', legal]]) {
  check(html.includes(`class="btn secondary nbdr-bmc-pill" href="${BMC}" target="_blank" rel="noopener noreferrer"`), `${name}: header Support pill.`);
  check(html.includes('href="/site-polish.css"'), `${name}: site-polish.css linked.`);
  check((html.match(/buymeacoffee\.com/g) || []).length === 1, `${name}: exactly one BMC link.`);
}

// Exactly one support card, below the roller (after </main>), before the mobile dock.
check((index.match(/class="nbdr-support-card"/g) || []).length === 1, 'Exactly one support card.');
check(index.indexOf('nbdr-support-card') > index.indexOf('</main>'), 'Support card is below the roller.');
check(index.indexOf('nbdr-support-card') < index.indexOf('mobile-play-dock'), 'Support card before the mobile dock markup.');
check(index.indexOf('id="dice-tray"') < index.indexOf('nbdr-extras'), 'Tray comes before the extras.');
const bmcLinks = index.match(/<a [^>]*buymeacoffee\.com[^>]*>/g) || [];
check(bmcLinks.length === 3, `index has 3 BMC links (desktop header, mobile header, card); found ${bmcLinks.length}.`);
check(bmcLinks.every((a) => a.includes('rel="noopener noreferrer"') && a.includes('target="_blank"')), 'BMC links open safely in a new tab.');

// Stylesheet wiring and CSP safety.
check(index.includes('<link id="site-polish-styles" rel="stylesheet" href="/site-polish.css">'), 'index links site-polish.css.');
check(index.indexOf('/custom.css') < index.indexOf('/site-polish.css'), 'site-polish.css loads after custom.css.');
check(build.includes("'site-polish.css',"), 'build.mjs copies site-polish.css.');
check(sw.includes("'/site-polish.css',"), 'Service worker precaches site-polish.css.');
check(!sw.includes('v20260915-table-speed1'), 'Service worker cache version bumped.');
check(!sw.includes('affiliate'), 'Affiliate files are not cache-first (config edits show up immediately).');
check(!/style="/.test(index.replace(/<script[\s\S]*?<\/script>/g, '')), 'No inline style attributes (CSP style-src self).');
check(!css.includes('@import'), 'site-polish.css has no @import.');

// Mobile header: Forge moves into More.
check(menu.includes("forgeProxy.rel = 'noopener noreferrer'"), 'Forge proxy in More menu.');
check(css.includes('a[href^="https://cbw29512.github.io/oneshot-forge/"]{display:none!important}'), 'Forge hidden from the mobile header row.');

// Affiliate slot: hidden, empty, script loaded after the app.
check(index.includes('<aside id="nbdr-gear" class="nbdr-gear" hidden aria-labelledby="nbdr-gear-title"></aside>'), 'Empty hidden gear slot.');
check(index.indexOf('/js/app.js') < index.indexOf('/js/affiliate-slots.js'), 'Affiliate script loads after the roller.');
check(AFFILIATE_CONFIG.enabled === false, 'Affiliate config disabled by default.');
check(AFFILIATE_CONFIG.disclosure === '', 'No disclosure until Chris writes one.');
const urls = AFFILIATE_CONFIG.groups.flatMap((group) => group.items.map((item) => item.url));
check(urls.length >= 9 && urls.every((url) => url === ''), 'Every affiliate URL is empty.');
check(Object.isFrozen(AFFILIATE_CONFIG) && Object.isFrozen(AFFILIATE_CONFIG.groups), 'Config is frozen.');
check(renderableGroups().length === 0, 'Default config renders nothing.');

// URL validation.
for (const bad of ['', 'http://amzn.to/abc', 'https://example.com/x', 'https://www.example.com/x', 'https://amzn.to/TODO', 'https://shop.test/your-link', 'https://localhost/x', 'javascript:alert(1)', 'https://placeholder.shop/x', 'not a url']) {
  check(!isRealAffiliateUrl(bad), `Rejects ${bad || '(empty)'}.`);
}
for (const good of ['https://amzn.to/3AbCdEf', 'https://www.dndbeyond.com/marketplace?ref=abc']) check(isRealAffiliateUrl(good), `Accepts ${good}.`);

// Rendering with a fake DOM.
function fakeDocument() {
  const make = (tag) => ({
    tagName: tag.toUpperCase(), className: '', textContent: '', children: [], dataset: {}, hidden: true,
    append(...nodes) { this.children.push(...nodes); }, replaceChildren() { this.children = []; },
  });
  return { createElement: make };
}
const all = (node) => [node, ...node.children.flatMap(all)];
const documentRef = fakeDocument();
const root = documentRef.createElement('aside');
const base = { enabled: true, heading: 'Gear', disclosure: 'Affiliate links: we may earn a commission.', groups: [
  { id: 'dice', title: 'Dice sets', items: [{ label: 'Real set', url: 'https://amzn.to/3AbCdEf', note: 'n' }, { label: 'Empty', url: '' }, { label: 'Fake', url: 'https://example.com/a' }] },
  { id: 'books', title: 'D&D books', items: [{ label: 'PHB', url: '' }] },
] };
check(renderAffiliateSlots(root, base, documentRef) === true && root.hidden === false, 'Renders with a real link + disclosure.');
const nodes = all(root);
const links = nodes.filter((node) => node.tagName === 'A');
check(links.length === 1 && links[0].href === 'https://amzn.to/3AbCdEf', 'Only the real link is rendered.');
check(links[0].rel === 'sponsored nofollow noopener noreferrer' && links[0].target === '_blank', 'Affiliate link rel/target.');
check(nodes.filter((node) => node.tagName === 'SECTION').length === 1, 'Empty groups are skipped.');
const disclosureIndex = nodes.findIndex((node) => node.className === 'nbdr-gear-disclosure');
check(disclosureIndex > -1 && disclosureIndex < nodes.indexOf(links[0]), 'Disclosure shown before the links.');
check(renderAffiliateSlots(root, { ...base, disclosure: '  ' }, documentRef) === false && root.hidden === true && root.children.length === 0, 'No disclosure, no render.');
check(renderAffiliateSlots(root, { ...base, enabled: false }, documentRef) === false && root.hidden === true, 'Disabled, no render.');

console.log(`Design pass checks passed: ${passed}/${passed}.`);
