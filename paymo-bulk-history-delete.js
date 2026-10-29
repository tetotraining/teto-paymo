(() => {
  const STORAGE_KEY = 'ready-expenses-v1';
  const CLIENT_KEY_STORAGE = 'paymo-d1-client-key-v1';

  const usageDateOf = (expense) => expense?.usageDate || expense?.usage_date || expense?.date || '';
  const monthOf = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value).slice(0, 7) : '';
  const monthLabel = (key) => {
    const [year, month] = String(key || '').split('-').map(Number);
    return year && month ? `${year}年${month}月` : key;
  };

  function ensureStyle() {
    if (document.getElementById('paymo-bulk-history-delete-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-bulk-history-delete-style';
    style.textContent = `
      .bulk-history-note{font-size:13px;line-height:1.6;color:var(--theme-muted);margin:0 4px 14px}
      .bulk-history-list{display:grid;gap:10px}
      .bulk-history-month{width:100%;border:0;background:var(--surface);color:var(--page-fg);border-radius:20px;padding:17px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;font-weight:900;font-size:16px}
      .bulk-history-month small{font-size:12px;color:var(--theme-muted);font-weight:800}
      .bulk-history-month:disabled{opacity:.45}
      .bulk-history-empty{background:var(--surface);color:var(--theme-muted);border-radius:20px;padding:24px 18px;text-align:center;font-size:13px;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  function monthsWithHistory() {
    const counts = new Map();
    expenses.forEach((expense) => {
      const key = monthOf(usageDateOf(expense));
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }

  function showView(id) {
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  }

  function showResultToast(text) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const original = toast.textContent;
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.textContent = original; }, 220);
    }, 1500);
  }

  function renderMonths() {
    const list = document.getElementById('bulkHistoryMonthList');
    if (!list) return;
    const months = monthsWithHistory();
    if (!months.length) {
      list.innerHTML = '<div class="bulk-history-empty">削除できる履歴はありません。</div>';
      return;
    }
    list.innerHTML = months.map(({ key, count }) => `
      <button type="button" class="bulk-history-month" data-month="${key}">
        <span>${monthLabel(key)}</span><small>${count}件</small>
      </button>`).join('');
    list.querySelectorAll('.bulk-history-month').forEach((button) => {
      button.onclick = () => confirmAndDelete(button.dataset.month || '');
    });
  }

  async function deleteRemote(id) {
    if (typeof window.paymoDeleteExpense !== 'function') return { ok: true, localOnly: true };
    return window.paymoDeleteExpense(id);
  }

  async function confirmAndDelete(month) {
    const targets = expenses.filter((expense) => monthOf(usageDateOf(expense)) === month);
    if (!targets.length) {
      renderMonths();
      return;
    }

    const label = monthLabel(month);
    if (!window.confirm(`${label}の決済履歴 ${targets.length}件を一括削除しますか？\nこの操作は取り消せません。`)) return;

    const buttons = Array.from(document.querySelectorAll('.bulk-history-month'));
    buttons.forEach((button) => { button.disabled = true; });

    const clientKey = localStorage.getItem(CLIENT_KEY_STORAGE) || '';
    const results = await Promise.all(targets.map(async (expense) => {
      try {
        const result = await deleteRemote(expense.id);
        return { id: expense.id, ok: !clientKey || result?.ok !== false };
      } catch {
        return { id: expense.id, ok: !clientKey };
      }
    }));

    const deletedIds = new Set(results.filter((result) => result.ok).map((result) => result.id));
    const failed = results.length - deletedIds.size;

    if (deletedIds.size) {
      expenses = expenses.filter((expense) => !deletedIds.has(expense.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
      if (typeof render === 'function') render();
    }

    renderMonths();
    if (failed) {
      showResultToast(`${deletedIds.size}件削除・${failed}件失敗`);
    } else {
      showResultToast(`${label}を削除しました`);
    }
  }

  function buildUi() {
    const menu = document.getElementById('menu');
    const menuList = menu?.querySelector('.menu-list');
    const app = document.querySelector('.app');
    if (!menuList || !app) return false;

    if (!document.getElementById('openBulkHistoryDelete')) {
      const button = document.createElement('button');
      button.id = 'openBulkHistoryDelete';
      button.className = 'menu-item';
      button.innerHTML = '<span>履歴一括削除</span><span>›</span>';
      menuList.appendChild(button);
    }

    let view = document.getElementById('bulkHistoryDelete');
    if (!view) {
      view = document.createElement('section');
      view.id = 'bulkHistoryDelete';
      view.className = 'view design-view';
      app.appendChild(view);
    }
    view.innerHTML = `
      <div class="design-head">
        <button id="bulkHistoryBack" class="design-back" aria-label="戻る">‹</button>
        <h1 class="design-title">履歴一括削除</h1>
      </div>
      <p class="bulk-history-note">削除する月を選択してください。選択した月の決済履歴は、グラフを含む集計データからも削除されます。</p>
      <div id="bulkHistoryMonthList" class="bulk-history-list"></div>`;

    document.getElementById('openBulkHistoryDelete').onclick = () => {
      renderMonths();
      showView('bulkHistoryDelete');
    };
    document.getElementById('bulkHistoryBack').onclick = () => showView('menu');
    renderMonths();
    return true;
  }

  function init() {
    ensureStyle();
    if (buildUi()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (buildUi() || tries >= 20) clearInterval(timer);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
