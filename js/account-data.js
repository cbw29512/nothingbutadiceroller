const DELETE_CONFIRMATION = 'DELETE MY CLOUD DATA';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Account data request failed.');
    error.code = data.code || null;
    throw error;
  }
  return data;
}

function accountDataPanel() {
  const panel = document.createElement('section');
  panel.id = 'account-data-panel';
  panel.className = 'account-data-panel';

  const label = document.createElement('span');
  label.className = 'section-label';
  label.textContent = 'Your cloud data';

  const copy = document.createElement('p');
  copy.className = 'account-data-copy';
  copy.textContent = 'Export or delete data saved on this service. Your sign-in account and data stored only in this browser are separate.';

  const actions = document.createElement('div');
  actions.className = 'account-data-actions';

  const exportButton = document.createElement('button');
  exportButton.id = 'export-cloud-data-btn';
  exportButton.className = 'btn secondary';
  exportButton.type = 'button';
  exportButton.textContent = 'Export My Cloud Data';

  const deleteButton = document.createElement('button');
  deleteButton.id = 'delete-cloud-data-btn';
  deleteButton.className = 'btn danger';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete My Cloud Data';

  actions.append(exportButton, deleteButton);
  panel.append(label, copy, actions);
  return panel;
}

function deleteDialog() {
  const dialog = document.createElement('dialog');
  dialog.id = 'delete-cloud-data-dialog';
  dialog.className = 'account-data-dialog';
  dialog.setAttribute('aria-labelledby', 'delete-cloud-data-title');

  const form = document.createElement('form');
  form.id = 'delete-cloud-data-form';
  form.method = 'dialog';

  const title = document.createElement('h3');
  title.id = 'delete-cloud-data-title';
  title.textContent = 'Delete cloud app data?';

  const copy = document.createElement('p');
  copy.textContent = 'This removes saved configurations, shortcuts, Dice Studio cloud sets and images, legacy themes, and related Community records. Your sign-in account and browser-local data remain.';

  const prompt = document.createElement('label');
  prompt.htmlFor = 'delete-cloud-data-confirmation';
  prompt.textContent = `Type ${DELETE_CONFIRMATION} to confirm.`;

  const input = document.createElement('input');
  input.id = 'delete-cloud-data-confirmation';
  input.className = 'text-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const status = document.createElement('p');
  status.id = 'delete-cloud-data-status';
  status.className = 'status-line';
  status.setAttribute('role', 'status');

  const actions = document.createElement('div');
  actions.className = 'account-data-dialog-actions';

  const cancel = document.createElement('button');
  cancel.id = 'cancel-delete-cloud-data';
  cancel.className = 'btn secondary';
  cancel.type = 'button';
  cancel.textContent = 'Cancel';

  const submit = document.createElement('button');
  submit.id = 'confirm-delete-cloud-data';
  submit.className = 'btn danger';
  submit.type = 'submit';
  submit.textContent = 'Delete Cloud Data';

  actions.append(cancel, submit);
  form.append(title, copy, prompt, input, status, actions);
  dialog.append(form);
  return dialog;
}

function ensureAccountDataMarkup() {
  const signedIn = document.getElementById('account-signed-in');
  if (!signedIn) return;
  if (!document.getElementById('account-data-panel')) signedIn.append(accountDataPanel());
  if (!document.getElementById('delete-cloud-data-dialog')) document.body.append(deleteDialog());
}

function setDialogStatus(message, kind = '') {
  const status = document.getElementById('delete-cloud-data-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

function downloadJson(data) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nothing-but-a-dice-roller-data.json';
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function initAccountDataControls({ onCloudDeleted, setMessage }) {
  ensureAccountDataMarkup();
  const exportButton = document.getElementById('export-cloud-data-btn');
  const deleteButton = document.getElementById('delete-cloud-data-btn');
  const dialog = document.getElementById('delete-cloud-data-dialog');
  const form = document.getElementById('delete-cloud-data-form');
  const input = document.getElementById('delete-cloud-data-confirmation');
  const cancel = document.getElementById('cancel-delete-cloud-data');
  const submit = document.getElementById('confirm-delete-cloud-data');

  exportButton?.addEventListener('click', async () => {
    try {
      exportButton.disabled = true;
      setMessage('Preparing your cloud-data export…');
      const response = await fetch('/api/account-data', { credentials: 'include' });
      const data = await parseResponse(response);
      downloadJson(data);
      setMessage('Cloud-data export downloaded.', 'ready');
    } catch (error) {
      console.error('Cloud-data export failed:', error);
      setMessage(error.message, 'error');
    } finally {
      exportButton.disabled = false;
    }
  });

  deleteButton?.addEventListener('click', () => {
    if (!dialog || typeof dialog.showModal !== 'function') {
      setMessage('Cloud-data deletion dialog is unavailable.', 'error');
      return;
    }
    input.value = '';
    setDialogStatus('This deletes server-stored app data. Your sign-in account and data saved only in this browser remain.');
    dialog.showModal();
    input.focus();
  });

  cancel?.addEventListener('click', () => {
    if (dialog?.open) dialog.close();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (input.value.trim() !== DELETE_CONFIRMATION) {
      setDialogStatus(`Type ${DELETE_CONFIRMATION} exactly to continue.`, 'error');
      input.focus();
      return;
    }
    try {
      submit.disabled = true;
      input.disabled = true;
      setDialogStatus('Deleting server-stored app data…');
      const response = await fetch('/api/account-data', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: DELETE_CONFIRMATION }),
      });
      await parseResponse(response);
      if (dialog.open) dialog.close();
      await onCloudDeleted?.();
      setMessage('Cloud app data deleted. Your sign-in account and browser-local data remain.', 'ready');
    } catch (error) {
      console.error('Cloud-data deletion failed:', error);
      setDialogStatus(error.message, 'error');
    } finally {
      submit.disabled = false;
      input.disabled = false;
    }
  });
}
