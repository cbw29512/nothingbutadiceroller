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
