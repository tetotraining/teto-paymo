(() => {
  let activeExpenseId = '';
  let deleteResolve = null;

  function ensureStyle() {
    if (document.getElementById('paymo-history-delete-confirm-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-history-delete-confirm-style';
    style.textContent = `
      .history-delete-confirm-backdrop{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.52);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
      .history-delete-confirm-backdrop[hidden]{display:none!important}
      .history-delete-confirm-card{width:min(100%,350px);background:var(--surface,#f7f7f5);color:var(--page-fg,#111);border:1px solid var(--theme-line,#d7d7d4);border-radius:24px;padding:22px;box-shadow:0 18px 55px rgba(0,0,0,.34)}
      .history-delete-confirm-title{font-size:20px;font-weight:900;margin:0 0 10px}
      .history-delete-confirm-message{font-size:14px;font-weight:700;line-height:1.6;margin:0 0 20px;color:var(--page-fg,#111)}
      .history-delete-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .history-delete-confirm-button{border:0;border-radius:15px;padding:13px 10px;font-weight:900;font-size:15px}
      .history-delete-confirm-cancel{background:var(--page-bg,#e9e9e6);color:var(--page-fg,#111);border:1px solid var(--theme-line,#d7d7d4)}
      .history-delete-confirm-delete{background:color-mix(in srgb,#E63946 14%,var(--surface,#f7f7f5));color:#E63946;border:1px solid color-mix(in srgb,#E63946 32%,transparent)}
    `;
    document.head.appendChild(style);
  }

  function closeConfirm(result) {
    const backdrop = document.getElementById('historyDeleteConfirmBackdrop');
    if (backdrop) backdrop.hidden = true;
    const resolve = deleteResolve;
    deleteResolve = null;
    if (resolve) resolve(Boolean(result));
  }

  function ensureUi() {
    ensureStyle();
    if (document.getElementById('historyDeleteConfirmBackdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'historyDeleteConfirmBackdrop';
    backdrop.className = 'history-delete-confirm-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="history-delete-confirm-card" role="dialog" aria-modal="true" aria-labelledby="historyDeleteConfirmTitle">
        <h3 id="historyDeleteConfirmTitle" class="history-delete-confirm-title">確認</h3>
        <p class="history-delete-confirm-message">この履歴を削除しますか？</p>
        <div class="history-delete-confirm-actions">
          <button id="historyDeleteConfirmCancel" type="button" class="history-delete-confirm-button history-delete-confirm-cancel">キャンセル</button>
          <button id="historyDeleteConfirmDelete" type="button" class="history-delete-confirm-button history-delete-confirm-delete">削除</button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeConfirm(false);
    });
    document.getElementById('historyDeleteConfirmCancel').onclick = () => closeConfirm(false);
    document.getElementById('historyDeleteConfirmDelete').onclick = () => closeConfirm(true);
  }

  function askDelete() {
    ensureUi();
    const backdrop = document.getElementById('historyDeleteConfirmBackdrop');
    if (!backdrop || deleteResolve) return Promise.resolve(false);
    backdrop.hidden = false;
    return new Promise((resolve) => { deleteResolve = resolve; });
  }

  async function performDelete() {
    const id = String(activeExpenseId || '');
    if (!id) return;
    const ok = await askDelete();
    if (!ok) return;

    expenses = expenses.filter((expense) => String(expense.id) !== id);
    localStorage.setItem(KEY, JSON.stringify(expenses));
    document.getElementById('historyEditClose')?.click();
    if (typeof render === 'function') render();

    try {
      if (typeof window.paymoDeleteExpense === 'function') await window.paymoDeleteExpense(id);
    } catch {}
  }

  document.addEventListener('click', (event) => {
    const row = event.target?.closest?.('#expenseHistoryRows .history-entry');
    if (row) activeExpenseId = String(row.dataset.expenseId || '');

    const button = event.target?.closest?.('#historyEditDelete');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    performDelete();
  }, true);

  ensureUi();
})();
