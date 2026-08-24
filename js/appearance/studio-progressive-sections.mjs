const SECTION_DEFINITIONS = [
  {
    key: 'dice',
    title: 'Dice',
    description: 'Body, faces, glow, and per-die look',
    legends: ['Set-wide dice look', 'Selected die look'],
  },
  {
    key: 'material',
    title: 'Material',
    description: 'Clear resin and interior effects',
    legends: ['Clear resin & inside'],
  },
  {
    key: 'surface',
    title: 'Surface',
    description: 'Finish, pattern, and face-edge inlay',
    legends: ['Surface finish', 'Surface pattern', 'Face-edge inlay'],
  },
  {
    key: 'faces',
    title: 'Faces',
    description: 'Text, symbols, font, size, and position',
    legends: ['Selected die faces'],
  },
  {
    key: 'tray',
    title: 'Tray',
    description: 'Color, glow, and background image',
    legends: ['Tray'],
  },
];

const STYLE_TEXT = `
.studio-editor-sections{display:grid;gap:.65rem;margin-top:.2rem}
.studio-editor-section{border:1px solid #334155;border-radius:13px;background:#0b1018;overflow:clip}
.studio-editor-section>summary{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.7rem .8rem;cursor:pointer;list-style:none;background:#121a25;color:#f8fafc;touch-action:manipulation}
.studio-editor-section>summary::-webkit-details-marker{display:none}
.studio-editor-section>summary::after{content:'+';flex:0 0 auto;width:1.6rem;height:1.6rem;display:grid;place-items:center;border:1px solid #475569;border-radius:8px;color:#bae6fd;font-weight:950;line-height:1}
.studio-editor-section[open]>summary::after{content:'−';border-color:#4ade80;color:#bbf7d0}
.studio-editor-section>summary:focus-visible{outline:3px solid #38bdf8;outline-offset:-3px}
.studio-editor-section-title{display:grid;gap:.08rem;min-width:0}
.studio-editor-section-title strong{font-size:.9rem}
.studio-editor-section-title small{color:#94a3b8;font-size:.7rem;font-weight:700;line-height:1.3}
.studio-editor-section-content{padding:.75rem}
.studio-editor-section-content>.studio-group:last-child{margin-bottom:0}
.studio-editor-section .studio-group{background:#0f141d}
@media(max-width:720px){
  .studio-editor-sections{gap:.5rem}
  .studio-editor-section>summary{min-height:52px;padding:.7rem}
  .studio-editor-section-content{padding:.65rem}
  .studio-editor-section{scroll-margin-top:5rem}
}
@media(prefers-reduced-motion:reduce){.studio-editor-section>summary{scroll-behavior:auto}}
`;

function ensureStyles(documentRef) {
  if (documentRef.getElementById('studio-progressive-section-styles')) return;
  const style = documentRef.createElement('style');
  style.id = 'studio-progressive-section-styles';
  style.textContent = STYLE_TEXT;
  documentRef.head.appendChild(style);
}

function legendText(fieldset) {
  return fieldset.querySelector(':scope > legend')?.textContent?.trim() || '';
}

function makeSection(documentRef, definition) {
  const details = documentRef.createElement('details');
  details.className = 'studio-editor-section';
  details.dataset.studioSection = definition.key;
  details.open = definition.key === 'dice';

  const summary = documentRef.createElement('summary');
  summary.innerHTML = '<span class="studio-editor-section-title"><strong></strong><small></small></span>';
  summary.querySelector('strong').textContent = definition.title;
  summary.querySelector('small').textContent = definition.description;

  const content = documentRef.createElement('div');
  content.className = 'studio-editor-section-content';
  details.append(summary, content);
  return { details, content };
}

export function bindStudioProgressiveSections({ documentRef = document } = {}) {
  try {
    const editor = documentRef.querySelector('.editor-panel');
    if (!editor) return null;
    ensureStyles(documentRef);

    let host = editor.querySelector(':scope > .studio-editor-sections');
    if (!host) {
      const fieldsets = [...editor.querySelectorAll(':scope > fieldset.studio-group')];
      if (!fieldsets.length) return null;
      host = documentRef.createElement('div');
      host.className = 'studio-editor-sections';
      fieldsets[0].insertAdjacentElement('beforebegin', host);

      for (const definition of SECTION_DEFINITIONS) {
        const { details, content } = makeSection(documentRef, definition);
        const matches = fieldsets.filter((fieldset) => definition.legends.includes(legendText(fieldset)));
        matches.forEach((fieldset) => content.appendChild(fieldset));
        host.appendChild(details);
      }

      const ungrouped = fieldsets.filter((fieldset) => !fieldset.closest('.studio-editor-section'));
      if (ungrouped.length) {
        const faces = host.querySelector('[data-studio-section="faces"] .studio-editor-section-content');
        ungrouped.forEach((fieldset) => faces?.appendChild(fieldset));
      }
    }

    function getSection(key) {
      return host.querySelector(`[data-studio-section="${key}"]`);
    }

    function open(key, { focus = false } = {}) {
      const section = getSection(key);
      if (!section) return false;
      section.open = true;
      if (focus) section.querySelector(':scope > summary')?.focus();
      return true;
    }

    documentRef.addEventListener('click', (event) => {
      if (event.target.closest('#new-set') || event.target.closest('#studio-library .studio-set-card')) open('dice');
    });

    return {
      open,
      getSection,
      keys: () => SECTION_DEFINITIONS.map(({ key }) => key),
    };
  } catch (error) {
    console.error('Failed to group Dice Studio editor controls:', error);
    return null;
  }
}
