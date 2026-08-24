const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPES = {
  d4: {
    clip: 'polygon(50% 2%, 97% 95%, 3% 95%)',
    outer: ['polygon', { points: '50,3 97,95 3,95' }],
    lines: ['50,3 50,67', '3,95 50,67', '97,95 50,67'],
  },
  d6: {
    clip: 'polygon(50% 3%, 94% 27%, 94% 73%, 50% 97%, 6% 73%, 6% 27%)',
    outer: ['polygon', { points: '50,3 94,27 94,73 50,97 6,73 6,27' }],
    lines: ['50,3 50,50 6,27', '50,50 94,27', '50,50 50,97', '50,50 6,73', '50,50 94,73'],
  },
  d8: {
    clip: 'polygon(50% 2%, 96% 50%, 50% 98%, 4% 50%)',
    outer: ['polygon', { points: '50,2 96,50 50,98 4,50' }],
    lines: ['50,2 50,50 4,50', '50,50 96,50', '50,50 50,98', '4,50 50,98', '96,50 50,98'],
  },
  d10: {
    clip: 'polygon(50% 2%, 80% 14%, 97% 47%, 82% 83%, 50% 98%, 18% 83%, 3% 47%, 20% 14%)',
    outer: ['polygon', { points: '50,2 80,14 97,47 82,83 50,98 18,83 3,47 20,14' }],
    lines: ['50,2 50,52', '20,14 50,52 80,14', '3,47 50,52 97,47', '18,83 50,52 82,83', '50,52 50,98'],
  },
  d12: {
    clip: 'polygon(50% 2%, 75% 8%, 94% 27%, 99% 52%, 87% 79%, 63% 96%, 37% 96%, 13% 79%, 1% 52%, 6% 27%, 25% 8%)',
    outer: ['polygon', { points: '50,2 75,8 94,27 99,52 87,79 63,96 37,96 13,79 1,52 6,27 25,8' }],
    lines: ['50,18 70,30 63,54 37,54 30,30 50,18', '25,8 30,30 6,27', '75,8 70,30 94,27', '99,52 63,54 87,79', '1,52 37,54 13,79', '37,54 50,82 63,54', '37,96 50,82 63,96'],
  },
  d20: {
    clip: 'polygon(50% 1%, 82% 12%, 98% 40%, 92% 72%, 69% 96%, 31% 96%, 8% 72%, 2% 40%, 18% 12%)',
    outer: ['polygon', { points: '50,1 82,12 98,40 92,72 69,96 31,96 8,72 2,40 18,12' }],
    lines: ['50,1 38,30 18,12', '50,1 62,30 82,12', '18,12 38,30 2,40', '82,12 62,30 98,40', '2,40 38,30 50,54 8,72', '98,40 62,30 50,54 92,72', '38,30 62,30 50,54', '8,72 50,54 31,96', '92,72 50,54 69,96', '31,96 50,54 69,96'],
  },
  d100: {
    clip: 'circle(48% at 50% 50%)',
    outer: ['circle', { cx: '50', cy: '50', r: '48' }],
    lines: ['50,2 50,98', '2,50 98,50', '16,16 84,84', '84,16 16,84', '10,32 90,68', '10,68 90,32'],
    ellipses: [
      { cx: '50', cy: '50', rx: '48', ry: '19' },
      { cx: '50', cy: '50', rx: '19', ry: '48' },
    ],
  },
};

function createSvgElement(documentRef, name, attrs = {}) {
  const element = documentRef.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function buildGeometryArt(documentRef, type) {
  const shape = SHAPES[type];
  if (!shape) return null;
  const svg = createSvgElement(documentRef, 'svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });
  svg.dataset.previewGeometryArt = type;
  const [outerName, outerAttrs] = shape.outer;
  svg.appendChild(createSvgElement(documentRef, outerName, outerAttrs));
  shape.lines.forEach((points) => svg.appendChild(createSvgElement(documentRef, 'polyline', { points })));
  (shape.ellipses || []).forEach((attrs) => svg.appendChild(createSvgElement(documentRef, 'ellipse', attrs)));
  return svg;
}

function decoratePreviewDie(documentRef, die) {
  const type = die.querySelector('small')?.textContent?.trim().toLowerCase();
  const shape = SHAPES[type];
  if (!shape) return;
  die.dataset.previewGeometry = type;
  die.style.clipPath = shape.clip;
  die.style.setProperty('--studio-preview-shadow', die.style.boxShadow || 'none');
  if (!die.querySelector('[data-preview-geometry-art]')) {
    const art = buildGeometryArt(documentRef, type);
    if (art) die.prepend(art);
  }
}

function decorateAll(documentRef, host) {
  host.querySelectorAll('.studio-preview-die').forEach((die) => decoratePreviewDie(documentRef, die));
}

export function bindStudioPreviewGeometry({ documentRef = document, windowRef = window } = {}) {
  try {
    const host = documentRef.getElementById('studio-preview-dice');
    if (!host) return null;
    const label = documentRef.querySelector('.studio-preview-panel .section-label');
    if (label) label.textContent = 'Physical Shape Preview';
    const note = documentRef.querySelector('.studio-preview-panel .studio-note');
    if (note) note.textContent = 'Each preview uses the correct tabletop die silhouette and facet layout. The roller remains the authoritative 3D physics view; appearance changes here are visual only.';
    decorateAll(documentRef, host);
    const Observer = windowRef.MutationObserver;
    if (typeof Observer === 'function') {
      const observer = new Observer(() => decorateAll(documentRef, host));
      observer.observe(host, { childList: true });
      return { refresh: () => decorateAll(documentRef, host), disconnect: () => observer.disconnect() };
    }
    return { refresh: () => decorateAll(documentRef, host), disconnect: () => {} };
  } catch (error) {
    console.error('Failed to bind physical Dice Studio preview geometry:', error);
    return null;
  }
}
