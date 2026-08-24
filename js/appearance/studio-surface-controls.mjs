import { buildAppearanceRenderPlan } from './render-plan.mjs';
import { normalizeSurfaceFinish } from './surface-style.mjs';

function scopeValue(q) {
  return q('finish-scope')?.value === 'selected' ? 'selected' : 'set';
}

function resolvedFinish(set, type, scope) {
  if (scope === 'selected') return buildAppearanceRenderPlan(set).dice[type].style.finish;
  return normalizeSurfaceFinish(set.appearance.diceSet.defaultStyle.finish);
}

function editableTarget(set, type, scope) {
  if (scope === 'set') {
    const style = set.appearance.diceSet.defaultStyle;
    style.finish = normalizeSurfaceFinish(style.finish);
    return style.finish;
  }
  const die = set.appearance.diceSet.dice[type];
  if (!die.styleOverrides.finish) {
    die.styleOverrides.finish = normalizeSurfaceFinish(buildAppearanceRenderPlan(set).dice[type].style.finish);
  }
  die.styleOverrides.finish = normalizeSurfaceFinish(die.styleOverrides.finish);
  return die.styleOverrides.finish;
}

function updateOutput(q, value) {
  const output = q('finish-intensity-output');
  if (output) output.textContent = `${Math.round(value * 100)}%`;
}

export function fillStudioSurfaceControls({ q, set, selectedDie, editable }) {
  try {
    const scope = scopeValue(q);
    const finish = resolvedFinish(set, selectedDie, scope);
    q('finish-scope').disabled = !editable;
    q('surface-finish').value = finish.type;
    q('finish-accent-color').value = finish.accentColor;
    q('finish-intensity').value = String(finish.intensity);
    updateOutput(q, finish.intensity);
    for (const id of ['surface-finish', 'finish-accent-color', 'finish-intensity']) q(id).disabled = !editable;
    const note = q('finish-scope-note');
    if (note) note.textContent = scope === 'selected'
      ? `Only ${selectedDie.toUpperCase()} gets this finish. Other dice keep the set-wide finish.`
      : 'This surface finish becomes the default for every die in the set.';
  } catch (error) {
    console.error('Failed to fill Dice Studio surface controls:', error);
    throw error;
  }
}

export function bindStudioSurfaceControls({ q, updateDraft, getSelectedDie, refresh, setStatus }) {
  try {
    q('finish-scope').addEventListener('change', refresh);
    q('surface-finish').addEventListener('change', () => {
      const scope = scopeValue(q); const type = getSelectedDie(); const value = q('surface-finish').value;
      updateDraft((set) => { editableTarget(set, type, scope).type = value; });
      setStatus(`${scope === 'selected' ? type.toUpperCase() : 'Set'} ${value} finish selected. Save the set to keep it.`, 'ready');
    });
    q('finish-accent-color').addEventListener('input', () => {
      const scope = scopeValue(q); const type = getSelectedDie();
      updateDraft((set) => { editableTarget(set, type, scope).accentColor = q('finish-accent-color').value; });
    });
    q('finish-intensity').addEventListener('input', () => {
      const value = Math.max(0, Math.min(1, Number(q('finish-intensity').value) || 0));
      const scope = scopeValue(q); const type = getSelectedDie();
      updateDraft((set) => { editableTarget(set, type, scope).intensity = value; });
      updateOutput(q, value);
    });
  } catch (error) {
    console.error('Failed to bind Dice Studio surface controls:', error);
    throw error;
  }
}
