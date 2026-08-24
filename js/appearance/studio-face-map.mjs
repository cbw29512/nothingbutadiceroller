import { getCanonicalFaceLabel } from './face-values.mjs';
import { getFaceLayout } from './face-layouts.mjs';
import { getVisualFace } from './face-customization.mjs';
import { faceFontStack } from './face-fonts.mjs';
import { faceGlyphPreviewTransform } from './face-glyph-position.mjs';
import { normalizeFaceGlyphScale } from './face-glyph-scale.mjs';
import { numberGlowTextShadow } from './number-glow.mjs';
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
      const faceLabel = getCanonicalFaceLabel(selectedDie, position.logicalFace);
      const scale = normalizeFaceGlyphScale(face.scale);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `face-node face-${position.shape}${position.logicalFace === selectedFace ? ' active' : ''}`;
      button.dataset.face = String(position.logicalFace);
      button.style.left = `${position.x}%`;
      button.style.top = `${position.y}%`;
      button.style.background = style.bodyColor;
      button.style.color = face.color || style.faceColor;
      button.style.fontFamily = faceFontStack(face.fontId);
      button.style.fontSize = `${(selectedDie === 'd20' ? 0.72 : 0.82) * scale}rem`;
      const glyph = document.createElement('span');
      glyph.dataset.faceGlyph = '';
      glyph.dataset.numberGlow = style.glow?.enabled ? 'active' : 'off';
      glyph.textContent = visualText(face);
      glyph.style.display = 'inline-block';
      glyph.style.transform = faceGlyphPreviewTransform(face.position);
      glyph.style.textShadow = numberGlowTextShadow(style.glow);
      glyph.style.pointerEvents = 'none';
      button.append(glyph);
      button.setAttribute('aria-label', `Face ${faceLabel}, shows ${visualText(face)}, logical result ${position.logicalFace}`);
      button.addEventListener('click', () => onSelect(position.logicalFace));
      return button;
    }));
  } catch (error) {
    console.error('Failed to render die face map:', error);
    throw error;
  }
}
