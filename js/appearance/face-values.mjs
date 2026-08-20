const STANDARD_RESULTS = Object.freeze({
  d4: [1, 2, 3, 4],
  d6: [1, 2, 3, 4, 5, 6],
  d8: [1, 2, 3, 4, 5, 6, 7, 8],
  d10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  d12: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  d20: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  d100: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
});

export function getCanonicalFaceResults(dieType) {
  try {
    const results = STANDARD_RESULTS[dieType];
    if (!results) throw new Error(`Unsupported die type: ${dieType}`);
    return [...results];
  } catch (error) {
    console.error('Failed to resolve canonical die face results:', error);
    throw error;
  }
}

export function isCanonicalFaceResult(dieType, logicalResult) {
  try {
    const value = Number(logicalResult);
    return Number.isFinite(value) && STANDARD_RESULTS[dieType]?.includes(value) === true;
  } catch (error) {
    console.error('Failed to validate canonical die face result:', error);
    return false;
  }
}

export function getCanonicalFaceLabel(dieType, logicalResult) {
  try {
    const value = Number(logicalResult);
    if (!isCanonicalFaceResult(dieType, value)) {
      throw new Error(`${logicalResult} is not a physical face result for ${dieType}.`);
    }
    if (dieType === 'd10' && value === 10) return '0';
    if (dieType === 'd100') return value === 0 ? '00' : String(value).padStart(2, '0');
    return String(value);
  } catch (error) {
    console.error('Failed to resolve canonical die face label:', error);
    throw error;
  }
}
