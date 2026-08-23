import { normalizeEdgeInlay } from './inlay-style.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';

function scopeValue(q) {
  return q('inlay-scope')?.value === 'selected' ? 'selected' : 'set';
}

function resolvedInlay(set, type, scope) {
  if (scope === 'selected') return buildAppearanceRenderPlan(set).dice[type].style.inlay;
  return normalizeEdgeInlay(set.appearance.diceSet.defaultStyle.inlay);
}

function editableTarget(set, type, scope) {
  if (scope === 'set') {
    const style = set.appearance.diceSet.defaultStyle;
    style.inlay = normalizeEdgeInlay(style.inlay);
    return style.inlay;
  }
  const die = set.appearance.diceSet.dice[type];
  if (!die.styleOverrides.inlay) {
    die.styleOverrides.inlay = normalizeEdgeInlay(buildAppearanceRenderPlan(set).dice[type].style.inlay);
  }
  die.styleOverrides.inlay = normalizeEdgeInlay(die.styleOverrides.inlay);
  return die.styleOverrides.inlay;
}

function updateOutput(q, id, value) {
  const output = q(id);
  if (output) output.textContent = `${Math.round(value * 100)}%`;
}

export function ensureStudioInlayControls(documentRef = document) {
  try {
    if (documentRef.getElementById('edge-inlay-group')) return;
    const anchor = documentRef.getElementById('surface-pattern-group');
    if (!anchor) throw new Error('Surface pattern group is required before edge-inlay controls.');
    const group = documentRef.createElement('fieldset');
    group.id = 'edge-inlay-group'; group.className = 'studio-group';
    group.innerHTML = `<legend>Face-edge inlay</legend>
      <label class="studio-field">Apply to
        <select id="inlay-scope" data-edit-control><option value="set">Whole set</option><option value="selected">Selected die only</option></select>
      </label>
      <p id="inlay-scope-note" class="studio-note">This edge inlay becomes the default for every die in the set.</p>
      <label class="studio-field">Inlay style
        <select id="edge-inlay" data-edit-control>
          <option value="none">None</option><option value="fine">Fine line</option><option value="bold">Bold line</option>
          <option value="dashed">Dashed</option><option value="dotted">Dotted</option>
        </select>
      </label>
      <label class="studio-field">Inlay color<input id="inlay-color" data-edit-control type="color" value="#f8fafc"></label>
      <label class="studio-field">Inlay intensity<span class="range-field"><input id="inlay-intensity" data-edit-control type="range" min="0" max="1" step="0.05" value="0.8"><output id="inlay-intensity-output" for="inlay-intensity">80%</output></span></label>
      <label class="studio-field">Line width<span class="range-field"><input id="inlay-width" data-edit-control type="range" min="0" max="1" step="0.05" value="0.5"><output id="inlay-width-output" for="inlay-width">50%</output></span></label>
      <p class="studio-note">The physical dice texture follows each canonical face's real UV perimeter. This changes artwork only—never shape, collider, result, RNG, or roll rules.</p>`;
    anchor.insertAdjacentElement('afterend', group);
  } catch (error) {
    console.error('Failed to create Dice Studio edge-inlay controls:', error);
    throw error;
  }
}

export function fillStudioInlayControls({ q, set, selectedDie, editable }) {
  try {
    const scope = scopeValue(q);
    const inlay = resolvedInlay(set, selectedDie, scope);
    q('inlay-scope').disabled = !editable;
    q('edge-inlay').value = inlay.type;
    q('inlay-color').value = inlay.color;
    q('inlay-intensity').value = String(inlay.intensity);
    q('inlay-width').value = String(inlay.width);
    updateOutput(q, 'inlay-intensity-output', inlay.intensity);
    updateOutput(q, 'inlay-width-output', inlay.width);
    for (const id of ['edge-inlay', 'inlay-color', 'inlay-intensity', 'inlay-width']) q(id).disabled = !editable;
    const note = q('inlay-scope-note');
    if (note) note.textContent = scope === 'selected'
      ? `Only ${selectedDie.toUpperCase()} gets this face-edge inlay. Other dice keep the set-wide inlay.`
      : 'This face-edge inlay becomes the default for every die in the set.';
  } catch (error) {
    console.error('Failed to fill Dice Studio edge-inlay controls:', error);
    throw error;
  }
}

export function bindStudioInlayControls({ q, updateDraft, getSelectedDie, refresh, setStatus }) {
  try {
    q('inlay-scope').addEventListener('change', refresh);
    q('edge-inlay').addEventListener('change', () => {
      const scope = scopeValue(q); const type = getSelectedDie(); const value = q('edge-inlay').value;
      updateDraft((set) => { editableTarget(set, type, scope).type = value; });
      setStatus(`${scope === 'selected' ? type.toUpperCase() : 'Set'} ${value} edge inlay selected. Save the set to keep it.`, 'ready');
    });
    q('inlay-color').addEventListener('input', () => {
      const scope = scopeValue(q); const type = getSelectedDie();
      updateDraft((set) => { editableTarget(set, type, scope).color = q('inlay-color').value; });
    });
    for (const [id, key, outputId] of [
      ['inlay-intensity', 'intensity', 'inlay-intensity-output'],
      ['inlay-width', 'width', 'inlay-width-output'],
    ]) {
      q(id).addEventListener('input', () => {
        const value = Math.max(0, Math.min(1, Number(q(id).value) || 0));
        const scope = scopeValue(q); const type = getSelectedDie();
        updateDraft((set) => { editableTarget(set, type, scope)[key] = value; });
        updateOutput(q, outputId, value);
      });
    }
  } catch (error) {
    console.error('Failed to bind Dice Studio edge-inlay controls:', error);
    throw error;
  }
}
