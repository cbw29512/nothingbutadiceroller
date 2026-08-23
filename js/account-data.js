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
