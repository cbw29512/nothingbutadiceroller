const STYLE_TEXT = `
.mobile-die-btn[data-type]{position:relative}
.mobile-die-btn[data-type].has-quantity{padding-right:.82rem;border-color:#7dd3fc;box-shadow:inset 0 0 0 1px rgba(56,189,248,.2)}
.mobile-die-btn[data-type].has-quantity::after{content:attr(data-count);position:absolute;top:2px;right:2px;min-width:1.05rem;height:1.05rem;padding:0 .18rem;display:grid;place-items:center;border:1px solid #bae6fd;border-radius:999px;background:#0c4a6e;color:#fff;font-size:.58rem;font-weight:950;line-height:1;pointer-events:none}
@media(max-width:390px){.mobile-die-btn[data-type].has-quantity{padding-right:.72rem}.mobile-die-btn[data-type].has-quantity::after{min-width:.95rem;height:.95rem;font-size:.54rem}}
`;

function ensureStyles(documentRef) {
  if (documentRef.getElementById('mobile-dice-quantity-styles')) return;
  const style = documentRef.createElement('style');
  style.id = 'mobile-dice-quantity-styles';
  style.textContent = STYLE_TEXT;
  documentRef.head.appendChild(style);
}

export function syncMobileDiceQuantities(counts = {}, documentRef = document) {
  try {
    ensureStyles(documentRef);
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
