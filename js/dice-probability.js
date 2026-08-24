function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function d20ThresholdProbability(dc, modifier) {
  const target = Number(dc) - Number(modifier);
  if (!Number.isFinite(target)) throw new TypeError('DC and modifier must be finite numbers.');
  const successfulFaces = clamp(21 - Math.ceil(target), 0, 20);
  const normal = successfulFaces / 20;
  return Object.freeze({
    target,
    successfulFaces,
    normal,
    advantage: 1 - ((1 - normal) ** 2),
    disadvantage: normal ** 2,
  });
}

function percent(value) {
  return `${(value * 100).toFixed(value === 0 || value === 1 ? 0 : 2).replace(/\.00$/, '')}%`;
}

function bindCalculator(doc) {
  const form = doc.querySelector('#probability-form');
  const dcInput = doc.querySelector('#probability-dc');
  const modifierInput = doc.querySelector('#probability-modifier');
  const normalOutput = doc.querySelector('#probability-normal');
  const advantageOutput = doc.querySelector('#probability-advantage');
  const disadvantageOutput = doc.querySelector('#probability-disadvantage');
  const explanation = doc.querySelector('#probability-explanation');
  if (!form || !dcInput || !modifierInput || !normalOutput || !advantageOutput || !disadvantageOutput || !explanation) return;

  const render = () => {
    const dc = Number(dcInput.value);
    const modifier = Number(modifierInput.value);
    if (!Number.isFinite(dc) || !Number.isFinite(modifier)) return;
    const result = d20ThresholdProbability(dc, modifier);
    normalOutput.textContent = percent(result.normal);
    advantageOutput.textContent = percent(result.advantage);
    disadvantageOutput.textContent = percent(result.disadvantage);
    const rawNeed = Math.ceil(result.target);
    if (result.successfulFaces === 20) {
      explanation.textContent = `DC ${dc} with ${modifier >= 0 ? '+' : ''}${modifier}: every d20 face meets this simple threshold.`;
    } else if (result.successfulFaces === 0) {
      explanation.textContent = `DC ${dc} with ${modifier >= 0 ? '+' : ''}${modifier}: no d20 face can meet this simple threshold.`;
    } else {
      explanation.textContent = `DC ${dc} with ${modifier >= 0 ? '+' : ''}${modifier}: you need a raw ${rawNeed} or higher, so ${result.successfulFaces} of 20 faces succeed normally.`;
    }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  dcInput.addEventListener('input', render);
  modifierInput.addEventListener('input', render);
  render();
}

if (typeof document !== 'undefined') bindCalculator(document);
