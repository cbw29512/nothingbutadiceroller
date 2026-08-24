import { canEditDiceSet } from './authorization.mjs';
import { replaceVisualFace } from './face-customization.mjs';
import { normalizeFaceFontId } from './face-fonts.mjs';
import { normalizeFaceGlyphPosition } from './face-glyph-position.mjs';
import { normalizeFaceGlyphScale } from './face-glyph-scale.mjs';
import { applyFaceStyleToDie } from './face-style-batch.mjs';
import { getCanonicalFaceResults } from './face-values.mjs';

function currentStyle(q) {
  return {
    color: q('custom-face-color').value,
    fontId: normalizeFaceFontId(q('face-font')?.value),
    scale: normalizeFaceGlyphScale(Number(q('face-scale')?.value || 100) / 100),
    position: normalizeFaceGlyphPosition(q('face-position')?.value),
  };
}

export function ensureStudioFaceStyleBatchControl(documentRef = document) {
  try {
    if (documentRef.getElementById('apply-face-style-all')) return;
    const applyButton = documentRef.getElementById('apply-face');
    const row = applyButton?.closest('.button-row');
    if (!row) throw new Error('Apply Face controls are required before batch face-style controls can be created.');
    const button = documentRef.createElement('button');
    button.id = 'apply-face-style-all';
    button.className = 'btn ghost';
    button.type = 'button';
    button.dataset.faceEditControl = '';
    button.textContent = 'Style All Faces';
    button.title = 'Copy this face’s color, font, size, and position to every face on the selected die.';
    row.append(button);

    const note = documentRef.createElement('p');
    note.id = 'face-style-all-note';
    note.className = 'studio-note';
    note.textContent = 'Style All preserves every face’s printed number, word, symbol, and logical result. It changes only color, font, size, and position.';
    row.insertAdjacentElement('afterend', note);
  } catch (error) {
    console.error('Failed to create batch face-style controls:', error);
    throw error;
  }
}

export function fillStudioFaceStyleBatchControl({ q, selectedDie, editable }) {
  const button = q('apply-face-style-all');
  if (!button) return;
  button.textContent = `Style All ${selectedDie.toUpperCase()} Faces`;
  button.disabled = !editable;
}

export function bindStudioFaceStyleBatchControl({
  q, getDraft, setDraft, getSelectedDie, getOwnerId, refresh, setStatus, windowRef = window,
}) {
  const button = q('apply-face-style-all');
  if (!button || button.dataset.boundFaceStyleBatch === 'true') return;
  button.dataset.boundFaceStyleBatch = 'true';
  button.addEventListener('click', () => {
    try {
      const set = getDraft();
      if (!canEditDiceSet(set, getOwnerId())) throw new Error('Unlock this set before styling faces.');
      const dieType = getSelectedDie();
      const faceCount = getCanonicalFaceResults(dieType).length;
      const approved = windowRef.confirm(`Apply this face’s color, font, size, and position to all ${faceCount} ${dieType.toUpperCase()} faces? Printed labels and roll results will stay unchanged.`);
      if (!approved) return setStatus('Style All cancelled. No faces were changed.', 'ready');
      const style = currentStyle(q);
      const logicalFace = q('logical-face').value;
      let next = replaceVisualFace(set, dieType, logicalFace, {
        kind: 'text',
        value: q('face-value').value.trim(),
        ...style,
      });
      next = applyFaceStyleToDie(next, dieType, style);
      setDraft(next);
      refresh();
      setStatus(`Applied this visual style to all ${faceCount} ${dieType.toUpperCase()} faces. Printed labels and roll results were preserved.`, 'ready');
    } catch (error) {
      console.error('Failed to batch-style die faces:', error);
      setStatus(error.message, 'error');
    }
  });
}
