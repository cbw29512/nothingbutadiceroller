import { canEditDiceSet } from './authorization.mjs';
import { replaceVisualFace, removeVisualFace, useRawFaces } from './face-customization.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';

export function bindStudioVisualControls(context) {
  const { q, updateDraft, getDraft, setDraft, getSelectedDie, getOwnerId, refresh, setStatus } = context;
  [['dice-body-color', 'bodyColor'], ['dice-face-color', 'faceColor']].forEach(([id, key]) => {
    q(id).addEventListener('input', () => updateDraft((set) => { set.appearance.diceSet.defaultStyle[key] = q(id).value; }));
  });
  q('dice-glow-enabled').addEventListener('change', () => updateDraft((set) => {
    set.appearance.diceSet.defaultStyle.glow.enabled = q('dice-glow-enabled').checked;
  }));
  q('dice-glow-color').addEventListener('input', () => updateDraft((set) => {
    set.appearance.diceSet.defaultStyle.glow.color = q('dice-glow-color').value;
    set.appearance.diceSet.defaultStyle.glow.intensity = 0.75;
  }));
  q('die-style-enabled').addEventListener('change', () => updateDraft((set) => {
    const type = getSelectedDie();
    if (!q('die-style-enabled').checked) {
      set.appearance.diceSet.dice[type].styleOverrides = {};
      return;
    }
    const effective = buildAppearanceRenderPlan(set).dice[type].style;
    set.appearance.diceSet.dice[type].styleOverrides = structuredClone(effective);
  }));
  [['die-body-color', 'bodyColor'], ['die-face-color', 'faceColor']].forEach(([id, key]) => {
    q(id).addEventListener('input', () => updateDraft((set) => {
      set.appearance.diceSet.dice[getSelectedDie()].styleOverrides[key] = q(id).value;
    }));
  });
  q('die-glow-enabled').addEventListener('change', () => updateDraft((set) => {
    set.appearance.diceSet.dice[getSelectedDie()].styleOverrides.glow.enabled = q('die-glow-enabled').checked;
  }));
  q('die-glow-color').addEventListener('input', () => updateDraft((set) => {
    const glow = set.appearance.diceSet.dice[getSelectedDie()].styleOverrides.glow;
    glow.color = q('die-glow-color').value;
    glow.intensity = 0.75;
  }));
  q('tray-color').addEventListener('input', () => updateDraft((set) => { set.appearance.tray.color = q('tray-color').value; }));
  q('tray-glow-enabled').addEventListener('change', () => updateDraft((set) => { set.appearance.tray.glow.enabled = q('tray-glow-enabled').checked; }));
  q('tray-glow-color').addEventListener('input', () => updateDraft((set) => {
    set.appearance.tray.glow.color = q('tray-glow-color').value;
    set.appearance.tray.glow.intensity = 0.75;
  }));
  q('face-mode').addEventListener('change', () => {
    const set = getDraft();
    if (q('face-mode').value !== 'raw' || !canEditDiceSet(set, getOwnerId())) return;
    setDraft(useRawFaces(set, getSelectedDie()));
    refresh();
  });
  q('apply-face').addEventListener('click', () => {
    try {
      const set = getDraft();
      if (!canEditDiceSet(set, getOwnerId())) throw new Error('Unlock this set before editing faces.');
      const next = q('face-mode').value === 'raw' ? useRawFaces(set, getSelectedDie()) : replaceVisualFace(
        set, getSelectedDie(), q('logical-face').value,
        { kind: q('face-kind').value, value: q('face-value').value.trim(), color: q('custom-face-color').value },
      );
      setDraft(next); refresh(); setStatus('Face appearance updated. Save the set to keep it.', 'ready');
    } catch (error) { setStatus(error.message, 'error'); }
  });
  q('remove-face').addEventListener('click', () => {
    try {
      const set = getDraft();
      if (!canEditDiceSet(set, getOwnerId())) throw new Error('Unlock this set before editing faces.');
      setDraft(removeVisualFace(set, getSelectedDie(), q('logical-face').value)); refresh();
    } catch (error) { setStatus(error.message, 'error'); }
  });
}
