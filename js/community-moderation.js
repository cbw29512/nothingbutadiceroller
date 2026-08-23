const q = (id) => document.getElementById(id);
const REASON_LABELS = {
  inappropriate: 'Inappropriate content',
  harassment: 'Harassment or hate',
  copyright: 'Copyright concern',
  privacy: 'Privacy concern',
  malicious: 'Malicious or unsafe content',
  other: 'Other',
};

function setStatus(message, kind = '') {
  const status = q('moderation-status');
  if (!status) return;
  status.textContent = message; status.dataset.kind = kind;
}
async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Moderation request failed.');
  return data;
}
async function requestModeration(body = null) {
  try {
    const options = { credentials: 'include' };
    if (body) {
      options.method = 'POST'; options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(body);
    }
    return await parse(await fetch('/api/community-moderation', options));
  } catch (error) {
    console.error('Community moderation API request failed:', error);
    throw error;
  }
}
function field(label, value) {
  const item = document.createElement('div'); item.className = 'moderation-field';
  const strong = document.createElement('strong'); strong.textContent = label;
  const span = document.createElement('span'); span.textContent = value || '—'; item.append(strong, span); return item;
}
function reportCard(report, reload) {
  const article = document.createElement('article'); article.className = `moderation-card${report.blocked ? ' blocked' : ''}`;
  const heading = document.createElement('div'); heading.className = 'moderation-card-heading';
  const title = document.createElement('h3'); title.textContent = report.setName || 'Community Dice Set';
  const badge = document.createElement('span'); badge.className = 'moderation-badge'; badge.textContent = report.blocked ? 'TAKEN DOWN' : 'PUBLIC';
  heading.append(title, badge);
  const details = document.createElement('div'); details.className = 'moderation-fields';
  details.append(
    field('Reason', REASON_LABELS[report.reason] || report.reason),
    field('Reported', report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Unknown'),
    field('Details', report.details || 'No additional details.'),
  );
  const actions = document.createElement('div'); actions.className = 'button-row moderation-actions';
  const button = document.createElement('button'); button.type = 'button';
  button.className = report.blocked ? 'btn secondary' : 'btn danger';
  button.textContent = report.blocked ? 'Lift Block' : 'Take Down Set';
  button.addEventListener('click', async () => {
    try {
      button.disabled = true; setStatus(report.blocked ? 'Lifting moderation block…' : 'Applying fail-closed takedown…');
      await requestModeration(report.blocked
        ? { action: 'lift', ownerId: report.ownerId, setId: report.setId }
        : { action: 'takedown', ownerId: report.ownerId, setId: report.setId, publicAccessId: report.publicAccessId, reason: report.reason });
      await reload();
    } catch (error) {
      setStatus(error.message, 'error');
    } finally { button.disabled = false; }
  });
  actions.append(button); article.append(heading, details, actions); return article;
}
async function loadReports() {
  try {
    setStatus('Loading moderation queue…');
    const data = await requestModeration(); const reports = Array.isArray(data.reports) ? data.reports : [];
    const host = q('moderation-reports');
    if (!reports.length) {
      const empty = document.createElement('p'); empty.className = 'studio-note'; empty.textContent = 'No Community reports are waiting for review.';
      host.replaceChildren(empty); setStatus('Moderation queue is clear.', 'ready'); return;
    }
    host.replaceChildren(...reports.map((report) => reportCard(report, loadReports)));
    setStatus(`${reports.length} report${reports.length === 1 ? '' : 's'} loaded.`, 'ready');
  } catch (error) {
    console.error('Failed to load Community moderation queue:', error);
    q('moderation-reports')?.replaceChildren(); setStatus(error.message, 'error');
  }
}

try {
  q('moderation-refresh').addEventListener('click', loadReports);
  loadReports();
} catch (error) {
  console.error('Community moderation page failed to initialize:', error);
  setStatus('Moderation page failed to initialize.', 'error');
}
