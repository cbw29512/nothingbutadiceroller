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

  const section = document.createElement('section');
  section.id = 'shortcut-toolbar-section';
  section.className = 'shortcut-toolbar-section';
  section.hidden = true;
  section.setAttribute('aria-labelledby', 'shortcut-toolbar-title');

  const heading = document.createElement('div');
  heading.className = 'shortcut-toolbar-heading';
  const title = document.createElement('span');
  title.id = 'shortcut-toolbar-title';
  title.className = 'section-label';
  title.textContent = 'My shortcuts';
  const note = document.createElement('span');
  note.className = 'shortcut-toolbar-note';
  note.textContent = 'Hold for details';
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
  quickSection.after(section);
}

function wrapRollButton(rollId, gearId, label) {
  const roll = document.getElementById(rollId);
  if (!roll || roll.parentElement?.classList.contains('shortcut-roll-cluster')) return;

  const cluster = document.createElement('div');
  cluster.className = 'shortcut-roll-cluster';
  roll.before(cluster);
  cluster.append(roll, makeGearButton(gearId, label));
}

export function ensureShortcutRuntimeMarkup() {
  ensureToolbarSection();
  wrapRollButton('roll-btn', 'shortcut-settings-btn', 'Manage roll shortcuts');
  wrapRollButton('mobile-roll-btn', 'mobile-shortcut-settings-btn', 'Manage roll shortcuts');
}
