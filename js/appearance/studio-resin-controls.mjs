import { buildAppearanceRenderPlan } from './render-plan.mjs';
import { normalizeInterior, normalizeTranslucency } from './resin-style.mjs';

function scopeValue(q) {
  return q('resin-scope')?.value === 'selected' ? 'selected' : 'set';
}

function resolvedStyle(set, type, scope) {
  if (scope === 'selected') return buildAppearanceRenderPlan(set).dice[type].style;
  const base = set.appearance.diceSet.defaultStyle;
  return {
    ...base,
    translucency: normalizeTranslucency(base.translucency, base.bodyColor),
    interior: normalizeInterior(base.interior),
  };
}

function editableTarget(set, type, scope) {
  if (scope === 'set') {
    const style = set.appearance.diceSet.defaultStyle;
    style.translucency = normalizeTranslucency(style.translucency, style.bodyColor);
    style.interior = normalizeInterior(style.interior);
    return style;
  }
  const die = set.appearance.diceSet.dice[type];
  const resolved = buildAppearanceRenderPlan(set).dice[type].style;
  if (!die.styleOverrides.translucency || !die.styleOverrides.interior) {
    die.styleOverrides = structuredClone(resolved);
  }
  die.styleOverrides.translucency = normalizeTranslucency(die.styleOverrides.translucency, die.styleOverrides.bodyColor);
  die.styleOverrides.interior = normalizeInterior(die.styleOverrides.interior);
  return die.styleOverrides;
}

function updateOutput(q, id, value) {
  const output = q(id);
  if (output) output.textContent = value;
}

export function fillStudioResinControls({ q, set, selectedDie, editable }) {
  const scope = scopeValue(q);
  const style = resolvedStyle(set, selectedDie, scope);
  const translucency = normalizeTranslucency(style.translucency, style.bodyColor);
  const interior = normalizeInterior(style.interior);
  q('resin-scope').disabled = !editable;
  q('clear-die-enabled').checked = translucency.enabled;
  q('clear-die-opacity').value = String(translucency.opacity);
  q('interior-effect').value = interior.enabled ? interior.type : 'none';
  q('interior-primary-color').value = interior.primaryColor;
  q('interior-secondary-color').value = interior.secondaryColor;
  q('interior-density').value = String(interior.density);
  updateOutput(q, 'clear-opacity-output', `${Math.round(translucency.opacity * 100)}%`);
  updateOutput(q, 'interior-density-output', `${Math.round(interior.density * 100)}%`);
  const effectDisabled = !editable || !interior.enabled;
  for (const id of ['clear-die-enabled', 'clear-die-opacity', 'interior-effect']) q(id).disabled = !editable;
  for (const id of ['interior-primary-color', 'interior-secondary-color', 'interior-density']) q(id).disabled = effectDisabled;
  const note = q('resin-scope-note');
  if (note) note.textContent = scope === 'selected'
    ? `Only ${selectedDie.toUpperCase()} gets this resin/interior look. Other dice keep the set-wide style.`
    : 'This resin/interior look becomes the default for every die in the set.';
}

export function bindStudioResinControls({ q, updateDraft, getSelectedDie, refresh, setStatus }) {
  q('resin-scope').addEventListener('change', refresh);
  q('clear-die-enabled').addEventListener('change', () => {
    const enabled = q('clear-die-enabled').checked;
    const scope = scopeValue(q); const type = getSelectedDie();
    updateDraft((set) => { editableTarget(set, type, scope).translucency.enabled = enabled; });
    setStatus(`${scope === 'selected' ? type.toUpperCase() : 'Set'} clear resin ${enabled ? 'enabled' : 'disabled'}. Save the set to keep it.`, 'ready');
  });
  q('clear-die-opacity').addEventListener('input', () => {
    const value = Math.max(0.25, Math.min(1, Number(q('clear-die-opacity').value) || 0.72));
    const scope = scopeValue(q); const type = getSelectedDie();
    updateDraft((set) => { editableTarget(set, type, scope).translucency.opacity = value; });
    updateOutput(q, 'clear-opacity-output', `${Math.round(value * 100)}%`);
  });
  q('interior-effect').addEventListener('change', () => {
    const selected = q('interior-effect').value;
    const scope = scopeValue(q); const type = getSelectedDie();
    updateDraft((set) => {
      const interior = editableTarget(set, type, scope).interior;
      interior.type = selected;
      interior.enabled = selected !== 'none';
    });
    setStatus(selected === 'none' ? 'Interior effect removed. Save the set to keep it.' : `${selected} interior selected. Adjust its colors and density, then save.`, 'ready');
  });
  [['interior-primary-color', 'primaryColor'], ['interior-secondary-color', 'secondaryColor']].forEach(([id, key]) => {
    q(id).addEventListener('input', () => {
      const scope = scopeValue(q); const type = getSelectedDie();
      updateDraft((set) => { editableTarget(set, type, scope).interior[key] = q(id).value; });
    });
  });
  q('interior-density').addEventListener('input', () => {
    const value = Math.max(0, Math.min(1, Number(q('interior-density').value) || 0));
    const scope = scopeValue(q); const type = getSelectedDie();
    updateDraft((set) => { editableTarget(set, type, scope).interior.density = value; });
    updateOutput(q, 'interior-density-output', `${Math.round(value * 100)}%`);
  });
}
