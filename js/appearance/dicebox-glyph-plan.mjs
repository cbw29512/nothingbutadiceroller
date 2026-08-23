import { CANONICAL_DICE } from './defaults.mjs';
import { extractDiceBoxFaceRegions } from './dicebox-atlas-layout.mjs';
import { extractD4VertexAnchors } from './dicebox-d4-layout.mjs';
import { normalizeFaceGlyphScale } from './face-glyph-scale.mjs';
import { getCanonicalFaceLabel, getCanonicalFaceResults } from './face-values.mjs';

const ICONS = Object.freeze({ skull: '☠', star: '★', flame: '🔥', shield: '◆', heart: '♥', sword: '⚔' });
function faceText(face, dieType, logicalResult) {
  if (!face) return getCanonicalFaceLabel(dieType, logicalResult);
  if (face.kind === 'icon') return ICONS[face.value] || String(face.value || '◆');
  return String(face.value ?? getCanonicalFaceLabel(dieType, logicalResult));
}
function faceColor(face, style) { return face?.color || style.faceColor; }
function centeredCommand(dieType, logicalResult, die, region) {
  const face = die.faces?.[String(logicalResult)] || null;
  return {
    dieType, logicalResult, strategy: 'centered-region', text: faceText(face, dieType, logicalResult),
    color: faceColor(face, die.style), fontId: face?.fontId || null, scale: normalizeFaceGlyphScale(face?.scale), region: structuredClone(region),
  };
}
function d4Command(logicalResult, die, anchor) {
  const face = die.faces?.[String(logicalResult)] || null;
  return {
    dieType: 'd4', logicalResult, strategy: 'tetrahedral-vertex-repeat', text: faceText(face, 'd4', logicalResult),
    color: faceColor(face, die.style), fontId: face?.fontId || null, scale: normalizeFaceGlyphScale(face?.scale), marks: structuredClone(anchor.marks),
  };
}
function needsEdgeInlay(die) { return Boolean(die?.style?.inlay?.type && die.style.inlay.type !== 'none'); }

export function buildDiceBoxGlyphPlan(renderPlan, modelData) {
  try {
    const commands = []; const d4Anchors = extractD4VertexAnchors(modelData);
    for (const type of Object.keys(CANONICAL_DICE)) {
      const die = renderPlan?.dice?.[type];
      if (!die) throw new Error(`Missing ${type} render instructions.`);
      if (type === 'd4') {
        for (const logicalResult of getCanonicalFaceResults(type)) commands.push(d4Command(logicalResult, die, d4Anchors[String(logicalResult)]));
        continue;
      }
      const regions = extractDiceBoxFaceRegions(modelData, type, { includeEdgeSegments: needsEdgeInlay(die) });
      for (const logicalResult of getCanonicalFaceResults(type)) commands.push(centeredCommand(type, logicalResult, die, regions[String(logicalResult)]));
    }
    return { atlasVersion: 1, sourceSetId: renderPlan.sourceSetId, commands };
  } catch (error) {
    console.error('Failed to build DiceBox glyph plan:', error); throw error;
  }
}
