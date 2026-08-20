const ID_RE = /[^a-z0-9]+/g;

export function slugifyShortcutId(value, fallback = 'shortcut') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(ID_RE, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

export function uniqueShortcutSlotId(shortcuts, baseId) {
  const base = slugifyShortcutId(baseId, 'shortcut');
  const used = new Set((shortcuts || []).map((slot) => slot.id));
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base.slice(0, 58)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('Unable to generate a unique shortcut id.');
}
