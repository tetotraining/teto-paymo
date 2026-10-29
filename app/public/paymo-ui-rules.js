(() => {
  const HISTORY_LIMIT = 20;

  function usageDateOf(expense) {
    return String(expense?.usageDate || expense?.usage_date || expense?.date || '');
  }

  function enforceHistoryLimit() {
    if (!Array.isArray(expenses) || expenses.length <= HISTORY_LIMIT) return false;

    const ranked = expenses
      .map((expense, index) => ({ expense, index, usageDate: usageDateOf(expense) }))
      .sort((a, b) => b.usageDate.localeCompare(a.usageDate) || b.index - a.index);

    const keepIndexes = new Set(ranked.slice(0, HISTORY_LIMIT).map((item) => item.index));
    const removed = ranked.slice(HISTORY_LIMIT).map((item) => item.expense);
    expenses = expenses.filter((_, index) => keepIndexes.has(index));
    localStorage.setItem(KEY, JSON.stringify(expenses));

    removed.forEach((expense) => {
      if (!expense?.id || typeof window.paymoDeleteExpense !== 'function') return;
      Promise.resolve(window.paymoDeleteExpense(expense.id)).catch(() => {});
    });

    return true;
  }

  function injectSelectionStyles() {
    if (document.getElementById('paymo-selection-clarity-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-selection-clarity-style';
    style.textContent = `
      .split-button,.history-edit-split-button{
        background:var(--surface)!important;
        color:var(--page-fg)!important;
        border-color:var(--theme-line)!important;
        box-shadow:none!important;
        transition:background .16s ease,color .16s ease,border-color .16s ease,box-shadow .16s ease,transform .08s ease;
      }
      .split-button.selected,.history-edit-split-button.selected{
        background:var(--accent)!important;
        color:var(--accent-ink)!important;
        border-color:var(--accent)!important;
        box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 38%,transparent)!important;
      }
      .split-button:active,.history-edit-split-button:active,.payee:active,.history-edit-payee:active{
        transform:scale(.98);
      }
      .payee.selected,.history-edit-payee.selected{
        box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 38%,transparent)!important;
      }
      .toggle:checked{
        box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 30%,transparent)!important;
      }
      .installment-details>.field:first-child .installment-grid,
      .installment-details>.field:first-child .installment-grid.three{
        grid-template-columns:1fr!important;
        gap:17px!important;
      }
      .installment-details>.field:first-child .installment-subfield{
        overflow:visible!important;
      }
      .installment-details>.field:first-child .installment-subfield>span{
        font-size:13px!important;
        letter-spacing:normal!important;
        margin-bottom:7px!important;
      }
      .installment-date{
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        height:auto!important;
        padding:13px!important;
        margin:0!important;
        border:1px solid var(--theme-line)!important;
        border-radius:15px!important;
        background:var(--surface)!important;
        color:var(--page-fg)!important;
        -webkit-text-fill-color:var(--page-fg)!important;
        font-size:16px!important;
        letter-spacing:normal!important;
        text-align:center!important;
        box-sizing:border-box!important;
        contain:none!important;
        color-scheme:dark;
      }
      html[data-theme="light"] .installment-date{
        color-scheme:light;
      }
    `;
    document.head.appendChild(style);
  }

  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) {
    render = function paymoRenderWithHistoryLimit(...args) {
      enforceHistoryLimit();
      return previousRender.apply(this, args);
    };
  }

  injectSelectionStyles();
  const changed = enforceHistoryLimit();
  if (changed && typeof render === 'function') render();
})();
