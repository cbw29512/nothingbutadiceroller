import { FACE_FONT_OPTIONS, normalizeFaceFontId } from './face-fonts.mjs';

export function ensureStudioFaceFontControl(documentRef = document) {
  try {
    if (documentRef.getElementById('face-font')) return;
    const colorInput = documentRef.getElementById('custom-face-color');
    const colorField = colorInput?.closest('.studio-field');
    if (!colorField) throw new Error('Face color field is required before typography controls can be created.');

    const field = documentRef.createElement('label');
    field.className = 'studio-field';
    field.append(documentRef.createTextNode('Face font'));
    const select = documentRef.createElement('select');
    select.id = 'face-font';
    select.dataset.faceEditControl = '';
    for (const option of FACE_FONT_OPTIONS) {
      const element = documentRef.createElement('option');
      element.value = option.id; element.textContent = option.label; select.append(element);
    }
    field.append(select);

    const note = documentRef.createElement('p');
    note.id = 'face-font-note';
    note.className = 'studio-note';
    note.textContent = 'Typography changes only what is printed on this face. The logical number underneath never changes.';
    colorField.insertAdjacentElement('afterend', field);
    field.insertAdjacentElement('afterend', note);
  } catch (error) {
    console.error('Failed to create face typography controls:', error);
    throw error;
  }
}

export function fillStudioFaceFontControl({ q, face, editable }) {
  const control = q('face-font');
  if (!control) return;
  const stored = normalizeFaceFontId(face?.fontId);
  control.value = stored === 'runic' ? 'fantasy' : stored;
  control.disabled = !editable;
}
