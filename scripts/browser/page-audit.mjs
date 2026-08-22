function auditPage() {
  const visible = (element) => {
    const style = getComputedStyle(element);
    return Boolean(element.getClientRects().length)
      && style.visibility !== 'hidden'
      && style.display !== 'none';
  };
  const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const controls = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(visible);
  const unlabeledControls = controls.filter((element) => !(
    element.labels?.length
    || element.getAttribute('aria-label')
    || element.getAttribute('aria-labelledby')
  )).map((element) => element.id || element.outerHTML.slice(0, 100));
  const actions = [...document.querySelectorAll('button, a[href]')].filter(visible);
  const unnamedActions = actions.filter((element) => !(
    element.getAttribute('aria-label')
    || element.getAttribute('aria-labelledby')
    || element.textContent.trim()
    || element.querySelector('img[alt]')
  )).map((element) => element.id || element.outerHTML.slice(0, 100));
  const dialogsWithoutName = [...document.querySelectorAll('[role="dialog"]')].filter((element) => {
    const labelledBy = element.getAttribute('aria-labelledby');
    return !(element.getAttribute('aria-label') || (labelledBy && document.getElementById(labelledBy)));
  }).map((element) => element.id || 'dialog');
  const viewportWidth = document.documentElement.clientWidth;
  const overflowingElements = [...document.querySelectorAll('body *')]
    .filter(visible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const overBy = Math.max(0, rect.right - viewportWidth, -rect.left);
      const name = element.id
        ? `#${element.id}`
        : `${element.tagName.toLowerCase()}${element.classList.length ? `.${[...element.classList].slice(0, 2).join('.')}` : ''}`;
      return { name, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), overBy: Math.ceil(overBy) };
    })
    .filter((item) => item.overBy > 1)
    .sort((left, right) => right.overBy - left.overBy)
    .slice(0, 8);

  return {
    title: document.title.trim(),
    lang: document.documentElement.lang.trim(),
    viewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
    mainCount: document.querySelectorAll('main').length,
    h1Count: document.querySelectorAll('h1').length,
    emptyHeadings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter((element) => !element.textContent.trim()).length,
    viewportWidth,
    overflowPixels: document.documentElement.scrollWidth - viewportWidth,
    overflowingElements,
    duplicates,
    unlabeledControls,
    unnamedActions,
    dialogsWithoutName,
  };
}

export const PAGE_AUDIT_EXPRESSION = `(${auditPage.toString()})()`;

export function assertPageAudit(audit, label) {
  const issues = [];
  if (!audit.title) issues.push('document title is empty');
  if (!audit.lang) issues.push('html lang is missing');
  if (!audit.viewportMeta) issues.push('viewport meta is missing');
  if (audit.mainCount !== 1) issues.push(`expected 1 main landmark, found ${audit.mainCount}`);
  if (audit.h1Count !== 1) issues.push(`expected 1 h1, found ${audit.h1Count}`);
  if (audit.emptyHeadings) issues.push(`${audit.emptyHeadings} empty heading(s)`);
  if (audit.overflowPixels > 1) {
    const offenders = audit.overflowingElements?.length
      ? `; offenders: ${audit.overflowingElements.map((item) => `${item.name} +${item.overBy}px`).join(', ')}`
      : '';
    issues.push(`${audit.overflowPixels}px horizontal overflow${offenders}`);
  }
  if (audit.duplicates.length) issues.push(`duplicate ids: ${audit.duplicates.join(', ')}`);
  if (audit.unlabeledControls.length) issues.push(`unlabeled controls: ${audit.unlabeledControls.join(', ')}`);
  if (audit.unnamedActions.length) issues.push(`unnamed actions: ${audit.unnamedActions.join(', ')}`);
  if (audit.dialogsWithoutName.length) issues.push(`unnamed dialogs: ${audit.dialogsWithoutName.join(', ')}`);
  if (issues.length) throw new Error(`${label} browser/a11y audit failed: ${issues.join(' | ')}`);
}
