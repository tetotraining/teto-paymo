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
