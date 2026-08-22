import { CUSTOM_FACE_MODE } from './defaults.mjs';
import { canEditDiceSet } from './authorization.mjs';
import { replaceVisualFace, removeVisualFace, useRawFaces } from './face-customization.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';
import { MAX_BROWSER_TRAY_IMAGE_BYTES, MAX_TRAY_IMAGE_BYTES } from './tray-image.mjs';

function ensureDieGlow(set, type) {
  const overrides = set.appearance.diceSet.dice[type].styleOverrides;
  if (!overrides.glow) overrides.glow = structuredClone(buildAppearanceRenderPlan(set).dice[type].style.glow);
  return overrides.glow;
}
function isBrowserOwner(ownerId) { return String(ownerId || '').startsWith('local_'); }
function readImageFile(file, maxBytes = MAX_TRAY_IMAGE_BYTES) {
  return new Promise((resolve, reject) => {
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return reject(new Error('Tray image must be PNG, JPEG, or WebP.'));
    if (file.size > maxBytes) {
      const message = maxBytes === MAX_BROWSER_TRAY_IMAGE_BYTES
        ? 'Guest tray images must be 512 KB or smaller. Sign in to save images up to 4 MB.'
        : 'Tray image must be 4 MB or smaller.';
      return reject(new Error(message));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read tray image.'));
    reader.readAsDataURL(file);
  });
}
export function bindStudioVisualControls(context) {
  const { q, updateDraft, getDraft, setDraft, getSelectedDie, getOwnerId, refresh, setStatus } = context;
  [['dice-body-color', 'bodyColor'], ['dice-face-color', 'faceColor']].forEach(([id, key]) => {
    q(id).addEventListener('input', () => updateDraft((set) => { set.appearance.diceSet.defaultStyle[key] = q(id).value; }));
  });
  q('dice-glow-enabled').addEventListener('change', () => updateDraft((set) => { set.appearance.diceSet.defaultStyle.glow.enabled = q('dice-glow-enabled').checked; }));
  q('dice-glow-color').addEventListener('input', () => updateDraft((set) => {
    set.appearance.diceSet.defaultStyle.glow.color = q('dice-glow-color').value; set.appearance.diceSet.defaultStyle.glow.intensity = 0.75;
  }));
  q('die-style-enabled').addEventListener('change', () => updateDraft((set) => {
    const type = getSelectedDie();
    if (!q('die-style-enabled').checked) { set.appearance.diceSet.dice[type].styleOverrides = {}; return; }
    set.appearance.diceSet.dice[type].styleOverrides = structuredClone(buildAppearanceRenderPlan(set).dice[type].style);
  }));
  [['die-body-color', 'bodyColor'], ['die-face-color', 'faceColor']].forEach(([id, key]) => {
    q(id).addEventListener('input', () => updateDraft((set) => { set.appearance.diceSet.dice[getSelectedDie()].styleOverrides[key] = q(id).value; }));
  });
  q('die-glow-enabled').addEventListener('change', () => updateDraft((set) => { ensureDieGlow(set, getSelectedDie()).enabled = q('die-glow-enabled').checked; }));
  q('die-glow-color').addEventListener('input', () => updateDraft((set) => {
    const glow = ensureDieGlow(set, getSelectedDie()); glow.color = q('die-glow-color').value; glow.intensity = 0.75;
  }));
  q('tray-color').addEventListener('input', () => updateDraft((set) => { set.appearance.tray.color = q('tray-color').value; }));
  q('tray-glow-enabled').addEventListener('change', () => updateDraft((set) => { set.appearance.tray.glow.enabled = q('tray-glow-enabled').checked; }));
  q('tray-glow-color').addEventListener('input', () => updateDraft((set) => {
    set.appearance.tray.glow.color = q('tray-glow-color').value; set.appearance.tray.glow.intensity = 0.75;
  }));
  q('tray-image').addEventListener('change', async () => {
    try {
      const file = q('tray-image').files?.[0];
      if (!file) return;
      const maxBytes = isBrowserOwner(getOwnerId()) ? MAX_BROWSER_TRAY_IMAGE_BYTES : MAX_TRAY_IMAGE_BYTES;
      const url = await readImageFile(file, maxBytes);
      updateDraft((set) => { set.appearance.tray.image = { kind: 'data', url }; });
      q('tray-image').value = '';
      setStatus('Tray image added visually. Save the set to keep it.', 'ready');
    } catch (error) {
      console.error('Failed to add tray image:', error); q('tray-image').value = ''; setStatus(error.message, 'error');
    }
  });
  q('remove-tray-image').addEventListener('click', () => updateDraft((set) => { set.appearance.tray.image = null; }));
  q('face-mode').addEventListener('change', () => {
    const set = getDraft();
    if (!canEditDiceSet(set, getOwnerId())) return;
    if (q('face-mode').value === 'raw') { setDraft(useRawFaces(set, getSelectedDie())); refresh(); return; }
    updateDraft((next) => { next.appearance.diceSet.dice[getSelectedDie()].faceMode = CUSTOM_FACE_MODE; });
  });
  q('apply-face').addEventListener('click', () => {
    try {
      const set = getDraft();
      if (!canEditDiceSet(set, getOwnerId())) throw new Error('Unlock this set before editing faces.');
      const logicalFace = q('logical-face').value;
      const next = replaceVisualFace(set, getSelectedDie(), logicalFace, {
        kind: 'text', value: q('face-value').value.trim(), color: q('custom-face-color').value,
      });
      setDraft(next); refresh(); setStatus(`Face ${logicalFace} updated visually. It still rolls ${logicalFace}.`, 'ready');
    } catch (error) { console.error('Failed to apply face appearance:', error); setStatus(error.message, 'error'); }
  });
  q('remove-face').addEventListener('click', () => {
    try {
      const set = getDraft();
      if (!canEditDiceSet(set, getOwnerId())) throw new Error('Unlock this set before editing faces.');
      setDraft(removeVisualFace(set, getSelectedDie(), q('logical-face').value)); refresh();
    } catch (error) { console.error('Failed to restore canonical face:', error); setStatus(error.message, 'error'); }
  });
}
