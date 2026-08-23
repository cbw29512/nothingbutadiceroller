import { normalizeSurfacePattern } from './pattern-style.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';

function scopeValue(q) {
  return q('pattern-scope')?.value === 'selected' ? 'selected' : 'set';
}

function resolvedPattern(set, type, scope) {
  if (scope === 'selected') return buildAppearanceRenderPlan(set).dice[type].style.pattern;
  return normalizeSurfacePattern(set.appearance.diceSet.defaultStyle.pattern);
}

function editableTarget(set, type, scope) {
  if (scope === 'set') {
    const style = set.appearance.diceSet.defaultStyle;
    style.pattern = normalizeSurfacePattern(style.pattern);
    return style.pattern;
  }
  const die = set.appearance.diceSet.dice[type];
  if (!die.styleOverrides.pattern) {
    die.styleOverrides.pattern = normalizeSurfacePattern(buildAppearanceRenderPlan(set).dice[type].style.pattern);
  }
  die.styleOverrides.pattern = normalizeSurfacePattern(die.styleOverrides.pattern);
  return die.styleOverrides.pattern;
}

function updateOutput(q, id, value) {
  const output = q(id);
  if (output) output.textContent = `${Math.round(value * 100)}%`;
}

export function fillStudioPatternControls({ q, set, selectedDie, editable }) {
  try {
    const scope = scopeValue(q);
    const pattern = resolvedPattern(set, selectedDie, scope);
    q('pattern-scope').disabled = !editable;
    q('surface-pattern').value = pattern.type;
    q('pattern-primary-color').value = pattern.primaryColor;
    q('pattern-secondary-color').value = pattern.secondaryColor;
    q('pattern-intensity').value = String(pattern.intensity);
    q('pattern-scale').value = String(pattern.scale);
    updateOutput(q, 'pattern-intensity-output', pattern.intensity);
    updateOutput(q, 'pattern-scale-output', pattern.scale);
    for (const id of ['surface-pattern', 'pattern-primary-color', 'pattern-secondary-color', 'pattern-intensity', 'pattern-scale']) {
      q(id).disabled = !editable;
    }
    const note = q('pattern-scope-note');
    if (note) note.textContent = scope === 'selected'
      ? `Only ${selectedDie.toUpperCase()} gets this pattern. Other dice keep the set-wide pattern.`
      : 'This surface pattern becomes the default for every die in the set.';
  } catch (error) {
    console.error('Failed to fill Dice Studio pattern controls:', error);
    throw error;
  }
}

export function bindStudioPatternControls({ q, updateDraft, getSelectedDie, refresh, setStatus }) {
  try {
    q('pattern-scope').addEventListener('change', refresh);
    q('surface-pattern').addEventListener('change', () => {
      const scope = scopeValue(q); const type = getSelectedDie(); const value = q('surface-pattern').value;
      updateDraft((set) => { editableTarget(set, type, scope).type = value; });
      setStatus(`${scope === 'selected' ? type.toUpperCase() : 'Set'} ${value} pattern selected. Save the set to keep it.`, 'ready');
    });
    for (const [id, key] of [['pattern-primary-color', 'primaryColor'], ['pattern-secondary-color', 'secondaryColor']]) {
      q(id).addEventListener('input', () => {
        const scope = scopeValue(q); const type = getSelectedDie();
        updateDraft((set) => { editableTarget(set, type, scope)[key] = q(id).value; });
      });
    }
    for (const [id, key, outputId] of [
      ['pattern-intensity', 'intensity', 'pattern-intensity-output'],
      ['pattern-scale', 'scale', 'pattern-scale-output'],
    ]) {
      q(id).addEventListener('input', () => {
        const value = Math.max(0, Math.min(1, Number(q(id).value) || 0));
        const scope = scopeValue(q); const type = getSelectedDie();
        updateDraft((set) => { editableTarget(set, type, scope)[key] = value; });
        updateOutput(q, outputId, value);
      });
    }
  } catch (error) {
    console.error('Failed to bind Dice Studio pattern controls:', error);
    throw error;
  }
}
