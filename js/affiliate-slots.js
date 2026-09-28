// Renders the optional "Gear for your table" affiliate box below the roller.
// Stays hidden (and does nothing) unless js/affiliate-config.js is filled with real links.
import { AFFILIATE_CONFIG } from './affiliate-config.js';

const PLACEHOLDER = /(^|[./-])(example|localhost|todo|placeholder|your-|xxx|changeme)/i;

export function isRealAffiliateUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  let url;
  try { url = new URL(value.trim()); } catch { return false; }
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) return false;
  return !PLACEHOLDER.test(url.hostname) && !PLACEHOLDER.test(url.pathname + url.search);
}

export function renderableGroups(config = AFFILIATE_CONFIG) {
  if (!config || config.enabled !== true) return [];
  if (typeof config.disclosure !== 'string' || !config.disclosure.trim()) return [];
  return (Array.isArray(config.groups) ? config.groups : [])
    .map((group) => ({
      id: String(group?.id || ''),
      title: String(group?.title || ''),
      items: (Array.isArray(group?.items) ? group.items : [])
        .filter((item) => item && typeof item.label === 'string' && item.label.trim() && isRealAffiliateUrl(item.url)),
    }))
    .filter((group) => group.title && group.items.length);
}

export function renderAffiliateSlots(root, config = AFFILIATE_CONFIG, documentRef = document) {
  if (!root) return false;
  const groups = renderableGroups(config);
  root.replaceChildren();
  if (!groups.length) {
    root.hidden = true;
    return false;
  }
  const make = (tag, className, text) => {
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const heading = make('h2', '', config.heading || 'Gear for your table');
  heading.id = 'nbdr-gear-title';
  const disclosure = make('p', 'nbdr-gear-disclosure', config.disclosure.trim());
  const wrap = make('div', 'nbdr-gear-groups');
  for (const group of groups) {
    const section = make('section', 'nbdr-gear-group');
    section.dataset.group = group.id;
    section.append(make('h3', '', group.title));
    const list = make('ul');
    for (const item of group.items) {
      const li = make('li');
      const link = make('a', '', item.label.trim());
      link.href = item.url.trim();
      link.target = '_blank';
      link.rel = 'sponsored nofollow noopener noreferrer';
      li.append(link);
      if (typeof item.note === 'string' && item.note.trim()) li.append(make('span', 'nbdr-gear-note', item.note.trim()));
      list.append(li);
    }
    section.append(list);
    wrap.append(section);
  }
  root.append(heading, disclosure, wrap);
  root.hidden = false;
  return true;
}

if (typeof document !== 'undefined') {
  try {
    renderAffiliateSlots(document.getElementById('nbdr-gear'));
  } catch (error) {
    console.error('Affiliate slots failed to render:', error);
  }
}
