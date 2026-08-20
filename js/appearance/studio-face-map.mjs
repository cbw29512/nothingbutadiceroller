import { getFaceLayout } from './face-layouts.mjs';
import { getVisualFace } from './face-customization.mjs';
import { buildAppearanceRenderPlan } from './render-plan.mjs';

const LEGACY_ICONS = { skull: '☠', star: '★', flame: '🔥', shield: '◆', heart: '♥', sword: '⚔' };
function visualText(face) {
  if (face?.kind === 'icon') return LEGACY_ICONS[face.value] || String(face.value || '◆');
  return String(face?.value ?? '');
}

export function renderFaceMap(set, selectedDie, selectedFace, onSelect) {
  try {
    const host = document.getElementById('face-map');
    if (!host) return;
    const style = buildAppearanceRenderPlan(set).dice[selectedDie].style;
    host.dataset.die = selectedDie;
    host.replaceChildren(...getFaceLayout(selectedDie).map((position) => {
      const face = getVisualFace(set, selectedDie, position.logicalFace);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `face-node face-${position.shape}${position.logicalFace === selectedFace ? ' active' : ''}`;
      button.dataset.face = String(position.logicalFace);
      button.style.left = `${position.x}%`;
      button.style.top = `${position.y}%`;
      button.style.background = style.bodyColor;
      button.style.color = face.color || style.faceColor;
      button.textContent = visualText(face);
      button.setAttribute('aria-label', `Face ${position.logicalFace}, shows ${visualText(face)}, always rolls ${position.logicalFace}`);
      button.addEventListener('click', () => onSelect(position.logicalFace));
      return button;
    }));
  } catch (error) {
    console.error('Failed to render die face map:', error);
    throw error;
  }
}
