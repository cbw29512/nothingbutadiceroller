const MOBILE_SHORTCUT_QUERY = '(max-width:700px)';
let shortcutMountMedia = null;

function makeGearButton(id, label) {
  const button = document.createElement('button');
  button.id = id;
  button.className = 'shortcut-settings-btn';
  button.type = 'button';
  button.hidden = true;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = '⚙';
  return button;
}

function ensureToolbarSection() {
  if (document.getElementById('shortcut-toolbar-section')) return;
  const quickGroup = document.querySelector('.quick-roll-group');
  const quickSection = quickGroup?.parentElement;
  if (!quickSection) return;

  const anchor = document.createElement('span');
  anchor.id = 'shortcut-toolbar-desktop-anchor';
  anchor.hidden = true;
  anchor.setAttribute('aria-hidden', 'true');

  const section = document.createElement('section');
  section.id = 'shortcut-toolbar-section';
  section.className = 'shortcut-toolbar-section';
  section.hidden = true;
  section.setAttribute('aria-labelledby', 'shortcut-toolbar-title');

  const heading = document.createElement('div');
  heading.className = 'shortcut-toolbar-heading';
  const title = document.createElement('span');
  title.id = 'shortcut-toolbar-title';
  title.className = 'section-label shortcut-toolbar-title';
  title.textContent = 'Roll shortcuts';
  const note = document.createElement('span');
  note.className = 'shortcut-toolbar-note';
  note.textContent = 'Hold or focus for details';
  heading.append(title, note);

  const toolbar = document.createElement('div');
  toolbar.id = 'shortcut-toolbar';
  toolbar.className = 'shortcut-toolbar';
  toolbar.hidden = true;
  toolbar.setAttribute('aria-label', 'Saved roll shortcuts');

  const tooltip = document.createElement('div');
  tooltip.id = 'shortcut-tooltip';
  tooltip.className = 'shortcut-tooltip';
  tooltip.hidden = true;
  tooltip.setAttribute('role', 'status');
  tooltip.setAttribute('aria-live', 'polite');

  section.append(heading, toolbar, tooltip);
  quickSection.after(anchor, section);
}

function wrapRollButton(rollId, gearId, label) {
  const roll = document.getElementById(rollId);
  if (!roll || roll.parentElement?.classList.contains('shortcut-roll-cluster')) return;

  const cluster = document.createElement('div');
  cluster.className = 'shortcut-roll-cluster';
  roll.before(cluster);
  cluster.append(roll, makeGearButton(gearId, label));
}

function ensureMobileShortcutHint() {
  if (document.getElementById('mobile-shortcut-hint')) return;
  const actionRow = document.getElementById('mobile-roll-btn')?.closest('.mobile-action-row');
  if (!actionRow) return;

  const hint = document.createElement('p');
  hint.id = 'mobile-shortcut-hint';
  hint.className = 'mobile-shortcut-hint';
  hint.hidden = true;
  hint.textContent = 'Customize roll shortcuts → ⚙';
  actionRow.before(hint);
}

function ensureMobileShortcutMount() {
  const existing = document.getElementById('mobile-shortcut-toolbar-mount');
  if (existing) return existing;
  const actionRow = document.getElementById('mobile-roll-btn')?.closest('.mobile-action-row');
  if (!actionRow) return null;
  const mount = document.createElement('div');
  mount.id = 'mobile-shortcut-toolbar-mount';
  mount.className = 'mobile-shortcut-toolbar-mount';
  mount.hidden = true;
  actionRow.before(mount);
  return mount;
}

function mobileShortcutLayoutActive() {
  return Boolean(globalThis.matchMedia?.(MOBILE_SHORTCUT_QUERY).matches);
}

function syncShortcutOnboarding() {
  const toolbar = document.getElementById('shortcut-toolbar');
  const title = document.getElementById('shortcut-toolbar-title');
  const note = document.querySelector('#shortcut-toolbar-section .shortcut-toolbar-note');
  const mobileHint = document.getElementById('mobile-shortcut-hint');
  const mobileMount = document.getElementById('mobile-shortcut-toolbar-mount');
  if (!toolbar || !title || !note || !mobileHint) return;
  const configured = toolbar.querySelectorAll('.shortcut-icon-btn').length > 0;
  title.textContent = configured ? 'My shortcuts' : 'Customize roll shortcuts → ⚙';
  note.textContent = 'Hold or focus for details';
  note.hidden = !configured;
  mobileHint.hidden = configured;
  if (mobileMount) mobileMount.hidden = !(configured && mobileShortcutLayoutActive());
}

function syncShortcutToolbarMount() {
  const section = document.getElementById('shortcut-toolbar-section');
  const anchor = document.getElementById('shortcut-toolbar-desktop-anchor');
  const mobileMount = ensureMobileShortcutMount();
  if (!section || !anchor || !mobileMount) return;
  if (mobileShortcutLayoutActive()) mobileMount.append(section);
  else anchor.after(section);
  queueMicrotask(syncShortcutOnboarding);
}

function observeShortcutToolbarMount() {
  if (shortcutMountMedia) return;
  shortcutMountMedia = globalThis.matchMedia?.(MOBILE_SHORTCUT_QUERY) || null;
  shortcutMountMedia?.addEventListener?.('change', syncShortcutToolbarMount);
  syncShortcutToolbarMount();
}

function observeShortcutOnboarding() {
  const toolbar = document.getElementById('shortcut-toolbar');
  if (!toolbar || toolbar.dataset.onboardingObserved === 'true') return;
  toolbar.dataset.onboardingObserved = 'true';
  const observer = new MutationObserver(() => queueMicrotask(syncShortcutOnboarding));
  observer.observe(toolbar, { childList: true, subtree: true });
  document.addEventListener('shortcutstatechange', () => queueMicrotask(syncShortcutOnboarding));
  queueMicrotask(syncShortcutOnboarding);
}

export function ensureShortcutRuntimeMarkup() {
  ensureToolbarSection();
  wrapRollButton('roll-btn', 'shortcut-settings-btn', 'Manage roll shortcuts');
  wrapRollButton('mobile-roll-btn', 'mobile-shortcut-settings-btn', 'Manage roll shortcuts');
  ensureMobileShortcutHint();
  ensureMobileShortcutMount();
  observeShortcutToolbarMount();
  observeShortcutOnboarding();
}
