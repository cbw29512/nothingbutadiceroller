export function syncMobileDiceQuantities(counts = {}, documentRef = document) {
  try {
    documentRef.querySelectorAll('.mobile-die-btn[data-type]').forEach((button) => {
      const type = button.dataset.type;
      const count = Number.isInteger(counts[type]) && counts[type] > 0 ? counts[type] : 0;
      if (count > 0) button.dataset.count = String(count);
      else delete button.dataset.count;
      button.classList.toggle('has-quantity', count > 0);
      button.setAttribute(
        'aria-label',
        count > 0
          ? `${type}, ${count} selected. Tap to add another.`
          : `${type}, none selected. Tap to add.`,
      );
    });
  } catch (error) {
    console.error('Failed to sync mobile dice quantities:', error);
  }
}
