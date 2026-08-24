import { faceGlyphScalePercent } from './face-glyph-scale.mjs';

export function ensureStudioFaceScaleControl(documentRef = document) {
  try {
    if (documentRef.getElementById('face-scale')) return;
    const fontControl = documentRef.getElementById('face-font');
    const fontField = fontControl?.closest('.studio-field');
    if (!fontField) throw new Error('Face font field is required before glyph-scale controls can be created.');

    const field = documentRef.createElement('label');
    field.className = 'studio-field';
    field.append(documentRef.createTextNode('Face size'));

    const row = documentRef.createElement('div');
    row.className = 'studio-range-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'minmax(0,1fr) auto';
    row.style.gap = '12px';
    row.style.alignItems = 'center';
    row.style.minHeight = '44px';

    const input = documentRef.createElement('input');
    input.id = 'face-scale';
    input.type = 'range';
    input.min = '60';
    input.max = '120';
    input.step = '5';
    input.value = '100';
    input.dataset.faceEditControl = '';
    input.style.width = '100%';
    input.style.minHeight = '44px';
    input.setAttribute('aria-describedby', 'face-scale-note');

    const output = documentRef.createElement('output');
    output.id = 'face-scale-output';
    output.setAttribute('for', 'face-scale');
    output.textContent = '100%';
    output.style.minWidth = '3.5rem';
    output.style.textAlign = 'right';
    output.style.fontWeight = '800';
    output.style.color = '#f8fafc';

    row.append(input, output);
    field.append(row);

    const note = documentRef.createElement('p');
    note.id = 'face-scale-note';
    note.className = 'studio-note';
    note.textContent = '60–120% visual size. Auto-fit and the physical face boundary still limit the final printed glyph.';

    const fontNote = documentRef.getElementById('face-font-note');
    (fontNote || fontField).insertAdjacentElement('afterend', field);
    field.insertAdjacentElement('afterend', note);
  } catch (error) {
    console.error('Failed to create face glyph-scale controls:', error);
    throw error;
  }
}

export function fillStudioFaceScaleControl({ q, face, editable }) {
  const input = q('face-scale');
  const output = q('face-scale-output');
  if (!input) return;
  const percent = faceGlyphScalePercent(face?.scale);
  input.value = String(percent);
  input.disabled = !editable;
  if (output) output.textContent = `${percent}%`;
}
