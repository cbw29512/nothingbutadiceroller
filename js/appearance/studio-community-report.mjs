export function createCommunityReportController({ q, submitReport, setStatus }) {
  let target = null;

  function dialogStatus(message, kind = '') {
    const status = q('community-report-status');
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }
  function open(set) {
    try {
      const dialog = q('community-report-dialog');
      if (!dialog || typeof dialog.showModal !== 'function') throw new Error('Report dialog is unavailable.');
      target = set;
      q('community-report-name').textContent = set?.name || 'Community Dice Set';
      q('community-report-reason').value = 'inappropriate';
      q('community-report-details').value = '';
      dialogStatus('Reports are private and reviewed by the site administrator.');
      dialog.showModal();
      q('community-report-reason').focus();
    } catch (error) {
      console.error('Failed to open Community report dialog:', error);
      setStatus('Unable to open the report form.', 'error');
    }
  }
  function close() {
    try {
      const dialog = q('community-report-dialog');
      if (dialog?.open) dialog.close();
      target = null;
    } catch (error) {
      console.error('Failed to close Community report dialog:', error);
    }
  }
  function decorate(sets = []) {
    try {
      const host = q('community-library');
      if (!host) return;
      const cards = [...host.querySelectorAll(':scope > .studio-set-card')];
      cards.forEach((card, index) => {
        const set = sets[index];
        if (!set || card.closest('.community-set-row')) return;
        const row = document.createElement('div'); row.className = 'community-set-row';
        const report = document.createElement('button');
        report.type = 'button'; report.className = 'btn ghost community-report-btn'; report.textContent = 'Report';
        report.setAttribute('aria-label', `Report ${set.name}`); report.addEventListener('click', () => open(set));
        card.replaceWith(row); row.append(card, report);
      });
    } catch (error) {
      console.error('Failed to add Community report controls:', error);
    }
  }
  async function submit(event) {
    event.preventDefault();
    const button = q('community-report-submit');
    try {
      if (!target?.id) throw new Error('Choose a Community dice set before reporting it.');
      if (button) button.disabled = true;
      dialogStatus('Submitting report…');
      const result = await submitReport({
        publicAccessId: target.id,
        reason: q('community-report-reason').value,
        details: q('community-report-details').value,
      });
      setStatus(result?.duplicate ? 'You already reported this Community set.' : 'Community report submitted.', 'ready');
      close();
    } catch (error) {
      console.error('Community report submission failed:', error);
      dialogStatus(error?.message || 'Unable to submit report.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }
  function bind() {
    try {
      q('community-report-form').addEventListener('submit', submit);
      q('community-report-cancel').addEventListener('click', close);
    } catch (error) {
      console.error('Failed to bind Community report dialog:', error);
      throw error;
    }
  }

  return { bind, decorate, open };
}
