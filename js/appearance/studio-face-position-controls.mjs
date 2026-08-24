import { FACE_GLYPH_POSITION_OPTIONS, normalizeFaceGlyphPosition } from './face-glyph-position.mjs';

export function ensureStudioFacePositionControl(documentRef = document) {
  try {
    if (documentRef.getElementById('face-position')) return;
    const scaleNote = documentRef.getElementById('face-scale-note');
    const scaleField = documentRef.getElementById('face-scale')?.closest('.studio-field');
    const anchor = scaleNote || scaleField;
    if (!anchor) throw new Error('Face scale controls are required before position controls can be created.');

    const field = documentRef.createElement('label');
    field.className = 'studio-field';
    field.append(documentRef.createTextNode('Face position'));

    const select = documentRef.createElement('select');
    select.id = 'face-position';
    select.dataset.faceEditControl = '';
    select.style.minHeight = '44px';
    for (const option of FACE_GLYPH_POSITION_OPTIONS) {
      const node = documentRef.createElement('option');
      node.value = option.id;
      node.textContent = option.label;
      select.append(node);
    }
    field.append(select);

    const note = documentRef.createElement('p');
    note.id = 'face-position-note';
    note.className = 'studio-note';
    note.textContent = 'Moves artwork within a bounded safe area of the physical face. The roll result never changes.';

    anchor.insertAdjacentElement('afterend', field);
    field.insertAdjacentElement('afterend', note);
  } catch (error) {
    console.error('Failed to create face-position controls:', error);
    throw error;
  }
}

export function fillStudioFacePositionControl({ q, face, editable }) {
  const select = q('face-position');
  if (!select) return;
  select.value = normalizeFaceGlyphPosition(face?.position);
  select.disabled = !editable;
}
