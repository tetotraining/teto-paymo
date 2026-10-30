(() => {
  if (document.getElementById('paymo-graph-detail-size-style')) return;
  const style = document.createElement('style');
  style.id = 'paymo-graph-detail-size-style';
  style.textContent = `
    #paymoGraphDetail .paymo-graph-detail-title{font-size:18px!important}
    #paymoGraphDetail .paymo-graph-detail-month{font-size:20px!important}
    #paymoGraphDetail .paymo-graph-detail-total{font-size:30px!important}
    #paymoGraphDetail .paymo-graph-detail-group-name{font-size:20px!important}
    #paymoGraphDetail .paymo-graph-detail-group-total{font-size:18px!important}
    #paymoGraphDetail .paymo-graph-detail-columns,
    #paymoGraphDetail .paymo-graph-detail-row{
      grid-template-columns:64px 72px minmax(0,1fr)!important;
      column-gap:8px!important;
    }
    #paymoGraphDetail .paymo-graph-detail-columns span:nth-child(2),
    #paymoGraphDetail .paymo-graph-detail-due{text-align:left!important}
    #paymoGraphDetail .paymo-graph-detail-date,
    #paymoGraphDetail .paymo-graph-detail-due{font-size:15px!important}
    #paymoGraphDetail .paymo-graph-detail-amount-cell,
    #paymoGraphDetail .paymo-graph-detail-columns span:last-child{text-align:right!important}
    #paymoGraphDetail .paymo-graph-detail-amount{font-size:17px!important}
    #paymoGraphDetail .paymo-graph-detail-paid{font-size:11px!important}
  `;
  document.head.appendChild(style);

  function formattedAmount(value) {
    const digits = String(value ?? '').replace(/[^0-9]/g, '');
    return digits ? Number(digits).toLocaleString('ja-JP') : '';
  }

  function formatAmountInput(input) {
    if (!input) return;
    const before = String(input.value ?? '');
    const next = formattedAmount(before);
    if (before === next) return;

    const active = document.activeElement === input;
    const cursor = active && typeof input.selectionStart === 'number' ? input.selectionStart : before.length;
    const digitsBeforeCursor = before.slice(0, cursor).replace(/[^0-9]/g, '').length;
    input.value = next;

    if (active && typeof input.setSelectionRange === 'function') {
      let position = 0;
      let digitsSeen = 0;
      while (position < next.length && digitsSeen < digitsBeforeCursor) {
        if (/\d/.test(next[position])) digitsSeen += 1;
        position += 1;
      }
      try { input.setSelectionRange(position, position); } catch {}
    }
  }

  function formatHistoryAmounts() {
    formatAmountInput(document.getElementById('historyEditAmount'));
    document.querySelectorAll('#historyEditParts input[id^="historyEditPartAmount"]').forEach(formatAmountInput);
  }

  document.addEventListener('input', (event) => {
    const input = event.target;
    if (!input?.matches?.('#historyEditAmount,#historyEditParts input[id^="historyEditPartAmount"]')) return;
    formatAmountInput(input);
    queueMicrotask(formatHistoryAmounts);
  }, true);

  const sheet = document.getElementById('historyEditSheet');
  if (sheet) {
    new MutationObserver(() => {
      if (!sheet.hidden) queueMicrotask(formatHistoryAmounts);
    }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
  }

  const parts = document.getElementById('historyEditParts');
  if (parts) {
    new MutationObserver(() => queueMicrotask(formatHistoryAmounts))
      .observe(parts, { childList: true, subtree: true });
  }

  formatHistoryAmounts();
})();
