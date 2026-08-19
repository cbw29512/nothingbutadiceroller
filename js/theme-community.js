import { state, savePreferences } from './state.js';
import { accountFetch, getIdentity } from './account-api.js';

let myThemes = [];
let communityThemes = [];

function setMessage(message, kind = '') {
  const el = document.getElementById('theme-studio-status');
  if (!el) return;
  el.textContent = message;
  el.className = `status-line ${kind}`.trim();
}

function toAppearance(theme) {
  const styles = theme?.customStyles || {};
  return {
    themeId: theme?.themeId || '',
    ownerId: theme?.ownerId || '',
    name: theme?.themeName || 'Custom Theme',
    trayName: theme?.trayName || 'Custom Tray',
    trayColor: styles.baseColor || '#0f172a',
    diceColor: styles.diceColor || '#b91c1c',
    imageUrl: theme?.imageUrl || null,
    enableGlow: Boolean(styles.enableGlow),
    glowColor: styles.glowColor || '#00ff66',
    isPublic: Boolean(theme?.isPublic),
  };
}

function applyTheme(theme) {
  try {
    state.customAppearance = toAppearance(theme);
    savePreferences();
    document.dispatchEvent(new Event('configurationloaded'));
    document.dispatchEvent(new Event('appearancechange'));
    setMessage(`Applied “${theme.themeName}”.`, 'ready');
  } catch (error) {
    console.error('Failed to apply community theme:', error);
    setMessage('Unable to apply theme.', 'error');
  }
}

function createThemeCard(theme, { mine = false } = {}) {
  const card = document.createElement('article');
  card.className = 'community-theme-card';

  const preview = document.createElement('div');
  preview.className = 'community-theme-preview';
  preview.style.background = theme.imageUrl
    ? `linear-gradient(rgba(2,6,23,.12),rgba(2,6,23,.12)),url("${theme.imageUrl}") center/cover`
    : theme.customStyles?.baseColor || '#0f172a';

  const die = document.createElement('span');
  die.className = 'community-die-preview';
  die.style.background = theme.customStyles?.diceColor || '#b91c1c';
  die.textContent = 'd20';
  preview.appendChild(die);

  const title = document.createElement('strong');
  title.textContent = theme.themeName || 'Untitled Theme';

  const meta = document.createElement('span');
  meta.className = 'community-theme-meta';
  meta.textContent = mine
    ? `${theme.trayName || 'Custom tray'} • ${theme.isPublic ? 'Shared' : 'Private'}`
    : `by ${theme.creator || 'Adventurer'}`;

  const actions = document.createElement('div');
  actions.className = 'community-theme-actions';

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'btn secondary';
  apply.textContent = 'Apply';
  apply.addEventListener('click', () => applyTheme(theme));
  actions.appendChild(apply);

  if (mine) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteTheme(theme.themeId));
    actions.appendChild(remove);
  }

  card.append(preview, title, meta, actions);
  return card;
}

function renderList(id, themes, options = {}) {
  const host = document.getElementById(id);
  if (!host) return;
  host.replaceChildren();

  if (!themes.length) {
    const empty = document.createElement('p');
    empty.className = 'status-line';
    empty.textContent = options.mine ? 'No custom themes saved yet.' : 'No community themes yet.';
    host.appendChild(empty);
    return;
  }

  host.append(...themes.map((theme) => createThemeCard(theme, options)));
}

async function loadCommunity() {
  try {
    const response = await fetch('/api/themes?scope=community', { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to load community themes.');
    communityThemes = Array.isArray(data.themes) ? data.themes : [];
    renderList('community-themes-list', communityThemes);
  } catch (error) {
    console.error('Community theme load failed:', error);
    setMessage(error.message, 'error');
  }
}

async function loadMine() {
  const user = getIdentity()?.currentUser();
  if (!user) {
    myThemes = [];
    renderList('my-themes-list', myThemes, { mine: true });
    return;
  }

  try {
    const data = await accountFetch('/api/themes');
    myThemes = Array.isArray(data.themes) ? data.themes : [];
    renderList('my-themes-list', myThemes, { mine: true });
  } catch (error) {
    console.error('Personal theme load failed:', error);
    setMessage(error.message, 'error');
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read tray image.'));
    reader.readAsDataURL(file);
  });
}

async function saveTheme() {
  try {
    if (!getIdentity()?.currentUser()) throw new Error('Sign in to save or share a custom theme.');

    const themeName = document.getElementById('custom-theme-name')?.value.trim();
    if (!themeName) throw new Error('Give your theme a name.');

    const trayImage = document.getElementById('custom-tray-image')?.files?.[0] || null;
    if (trayImage && trayImage.size > 4 * 1024 * 1024) {
      throw new Error('Tray image must be 4 MB or smaller.');
    }

    setMessage('Saving theme…');
    const trayImageBase64 = trayImage ? await fileToDataUrl(trayImage) : null;
    const payload = {
      themeName,
      trayName: document.getElementById('custom-tray-name')?.value.trim() || 'Custom Tray',
      isPublic: Boolean(document.getElementById('custom-theme-public')?.checked),
      trayImageBase64,
      customStyles: {
        baseColor: document.getElementById('custom-tray-color')?.value || '#0f172a',
        diceColor: document.getElementById('custom-dice-color')?.value || '#b91c1c',
        numberColor: '#f8fafc',
        enableGlow: Boolean(document.getElementById('custom-theme-glow')?.checked),
        glowColor: document.getElementById('custom-glow-color')?.value || '#00ff66',
        opacity: 1,
        customFaces: {},
      },
    };

    const data = await accountFetch('/api/save-theme', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    applyTheme(data.themeData);
    await Promise.all([loadMine(), loadCommunity()]);
    setMessage(payload.isPublic ? 'Theme saved and shared with the community.' : 'Private theme saved.', 'ready');
  } catch (error) {
    console.error('Theme save failed:', error);
    setMessage(error.message || 'Unable to save theme.', 'error');
  }
}

async function deleteTheme(themeId) {
  try {
    await accountFetch(`/api/themes?id=${encodeURIComponent(themeId)}`, { method: 'DELETE' });
    if (state.customAppearance?.themeId === themeId) {
      state.customAppearance = null;
      savePreferences();
      document.dispatchEvent(new Event('configurationloaded'));
    }
    await Promise.all([loadMine(), loadCommunity()]);
    setMessage('Theme deleted.', 'ready');
  } catch (error) {
    console.error('Theme delete failed:', error);
    setMessage(error.message, 'error');
  }
}

export function initThemeCommunity() {
  try {
    document.getElementById('save-custom-theme-btn')?.addEventListener('click', saveTheme);
    document.getElementById('refresh-community-themes-btn')?.addEventListener('click', loadCommunity);

    const auth = getIdentity();
    auth?.on('login', () => loadMine());
    auth?.on('logout', () => loadMine());
    auth?.on('init', () => loadMine());

    loadCommunity();
    loadMine();
  } catch (error) {
    console.error('Theme community initialization failed:', error);
    setMessage('Theme community failed to initialize.', 'error');
  }
}
