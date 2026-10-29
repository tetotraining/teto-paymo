(() => {
  const STORAGE_KEY = 'ready-expenses-v1';
  const CLIENT_KEY_STORAGE = 'paymo-d1-client-key-v1';
  const PENDING_DELETE_KEY = 'paymo-pending-delete-v1';

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
      .bulk-history-shade{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.58);display:flex;justify-content:center;align-items:flex-start;opacity:0;transition:opacity .22s ease}
      .bulk-history-shade.open{opacity:1}
      .bulk-history-sheet{width:min(100%,430px);max-height:min(78dvh,720px);overflow:auto;background:var(--surface);color:var(--page-fg);border-radius:0 0 30px 30px;padding:calc(env(safe-area-inset-top) + 16px) 18px 22px;box-shadow:0 16px 40px rgba(0,0,0,.34);transform:translateY(-105%);transition:transform .26s cubic-bezier(.2,.8,.2,1);box-sizing:border-box;scrollbar-width:none;overscroll-behavior:contain}
      .bulk-history-sheet::-webkit-scrollbar{display:none}
      .bulk-history-shade.open .bulk-history-sheet{transform:translateY(0)}
      .bulk-history-topline{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .bulk-history-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--theme-muted)}
      .bulk-history-close{width:34px;height:34px;border:0;border-radius:50%;background:var(--page-bg);color:var(--page-fg);font-size:22px;line-height:1;display:grid;place-items:center}
      .bulk-history-title{font-size:26px;line-height:1.15;margin:12px 0 8px;font-weight:900;letter-spacing:-.5px}
      .bulk-history-note{font-size:13px;line-height:1.6;color:var(--theme-muted);margin:0 0 16px}
      .bulk-history-list{display:grid;gap:10px}
      .bulk-history-month{width:100%;border:1px solid var(--theme-line);background:var(--page-bg);color:var(--page-fg);border-radius:18px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;font-weight:900;font-size:16px}
      .bulk-history-month small{font-size:12px;color:var(--theme-muted);font-weight:800}
      .bulk-history-empty{background:var(--page-bg);color:var(--theme-muted);border-radius:18px;padding:24px 18px;text-align:center;font-size:13px;font-weight:700}
      .bulk-history-confirm-note{font-size:14px;line-height:1.65;color:var(--theme-muted);margin:10px 0 0}
      .bulk-history-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:26px}
      .bulk-history-actions button{min-height:52px;border:0;border-radius:16px;font:inherit;font-weight:900}
      .bulk-history-delete-yes{background:#E63946;color:#fff}
      .bulk-history-delete-no{background:var(--page-bg);color:var(--page-fg);border:1px solid var(--theme-line)!important}
      .bulk-history-actions button:disabled{opacity:.45}
      .bulk-history-handle{width:42px;height:5px;background:var(--theme-muted);opacity:.55;border-radius:99px;margin:20px auto 0}
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

  function readPending() {
    try {
      const raw = JSON.parse(localStorage.getItem(PENDING_DELETE_KEY) || '[]');
      return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function addPending(ids) {
    const next = Array.from(new Set([...readPending(), ...ids.map(String).filter(Boolean)]));
    localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(next));
  }

  function clearPending(ids) {
    const removed = new Set(ids.map(String));
    const next = readPending().filter((id) => !removed.has(id));
    if (next.length) localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(next));
    else localStorage.removeItem(PENDING_DELETE_KEY);
  }

  async function deleteRemoteBulk(ids) {
    const key = localStorage.getItem(CLIENT_KEY_STORAGE) || '';
    if (!key || !ids.length) return false;
    try {
      const response = await fetch('/api/expenses/bulk-delete', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'x-paymo-key': key
        },
        body: JSON.stringify({ ids }),
        cache: 'no-store'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  function closeFlow() {
    const shade = document.getElementById('bulkHistoryFlowShade');
    if (!shade) return;
    shade.classList.remove('open');
    setTimeout(() => shade.remove(), 230);
  }

  function bindShade(shade) {
    shade.onclick = (event) => { if (event.target === shade) closeFlow(); };
    shade.querySelector('.bulk-history-close')?.addEventListener('click', closeFlow);
    const sheet = shade.querySelector('.bulk-history-sheet');
    if (!sheet) return;
    let startY = 0;
    let startX = 0;
    let lastY = 0;
    let lastX = 0;
    let tracking = false;
    sheet.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      startY = lastY = touch.clientY;
      startX = lastX = touch.clientX;
      tracking = true;
    }, { passive: true });
    sheet.addEventListener('touchmove', (event) => {
      if (!tracking || event.touches.length !== 1) return;
      const touch = event.touches[0];
      lastY = touch.clientY;
      lastX = touch.clientX;
      if (Math.abs(lastX - startX) > Math.abs(lastY - startY) * 1.2) tracking = false;
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
      if (!tracking) return;
      tracking = false;
      const dy = lastY - startY;
      const dx = Math.abs(lastX - startX);
      if (dy <= -70 && Math.abs(dy) > dx * 1.2) closeFlow();
    }, { passive: true });
    sheet.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });
  }

  function mountSheet(innerHtml) {
    document.getElementById('bulkHistoryFlowShade')?.remove();
    const shade = document.createElement('div');
    shade.id = 'bulkHistoryFlowShade';
    shade.className = 'bulk-history-shade';
    shade.innerHTML = `<section class="bulk-history-sheet">${innerHtml}<div class="bulk-history-handle"></div></section>`;
    document.body.appendChild(shade);
    bindShade(shade);
    requestAnimationFrame(() => requestAnimationFrame(() => shade.classList.add('open')));
    return shade;
  }

  function openPicker() {
    const months = monthsWithHistory();
    const list = months.length
      ? months.map(({ key, count }) => `
          <button type="button" class="bulk-history-month" data-month="${key}">
            <span>${monthLabel(key)}</span><small>${count}件</small>
          </button>`).join('')
      : '<div class="bulk-history-empty">削除できる履歴はありません。</div>';

    const shade = mountSheet(`
      <div class="bulk-history-topline"><span class="bulk-history-kicker">DELETE HISTORY</span><button type="button" class="bulk-history-close" aria-label="閉じる">×</button></div>
      <h1 class="bulk-history-title">削除する月を選択</h1>
      <p class="bulk-history-note">選択した月の決済履歴をまとめて削除します。</p>
      <div class="bulk-history-list">${list}</div>`);

    shade.querySelectorAll('.bulk-history-month').forEach((button) => {
      button.onclick = () => openConfirm(button.dataset.month || '');
    });
  }

  function openConfirm(month) {
    const targets = expenses.filter((expense) => monthOf(usageDateOf(expense)) === month);
    if (!targets.length) {
      openPicker();
      return;
    }
    const label = monthLabel(month);
    const shade = mountSheet(`
      <div class="bulk-history-topline"><span class="bulk-history-kicker">DELETE HISTORY</span><button type="button" class="bulk-history-close" aria-label="閉じる">×</button></div>
      <h1 class="bulk-history-title">${label}の履歴を削除しますか？</h1>
      <p class="bulk-history-confirm-note">決済履歴 ${targets.length}件を一括削除します。この操作は取り消せません。</p>
      <div class="bulk-history-actions">
        <button type="button" class="bulk-history-delete-yes">削除する</button>
        <button type="button" class="bulk-history-delete-no">キャンセル</button>
      </div>`);

    shade.querySelector('.bulk-history-delete-no').onclick = openPicker;
    shade.querySelector('.bulk-history-delete-yes').onclick = () => executeDelete(month);
  }

  async function executeDelete(month) {
    const targets = expenses.filter((expense) => monthOf(usageDateOf(expense)) === month);
    if (!targets.length) {
      closeFlow();
      return;
    }

    const ids = targets.map((expense) => String(expense.id || '')).filter(Boolean);
    const label = monthLabel(month);
    const yes = document.querySelector('#bulkHistoryFlowShade .bulk-history-delete-yes');
    const no = document.querySelector('#bulkHistoryFlowShade .bulk-history-delete-no');
    if (yes) { yes.disabled = true; yes.textContent = '削除中…'; }
    if (no) no.disabled = true;

    const idSet = new Set(ids);
    expenses = expenses.filter((expense) => !idSet.has(String(expense.id || '')));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    if (typeof render === 'function') render();

    const remoteOk = await deleteRemoteBulk(ids);
    if (remoteOk) clearPending(ids);
    else addPending(ids);

    closeFlow();
    showResultToast(`${label}を削除しました`);
  }

  function buildMenuItem() {
    const menuList = document.getElementById('menu')?.querySelector('.menu-list');
    if (!menuList) return false;
    let button = document.getElementById('openBulkHistoryDelete');
    if (!button) {
      button = document.createElement('button');
      button.id = 'openBulkHistoryDelete';
      button.className = 'menu-item';
      button.innerHTML = '<span>履歴一括削除</span><span>›</span>';
      menuList.appendChild(button);
    }
    button.onclick = openPicker;
    return true;
  }

  function init() {
    ensureStyle();
    document.getElementById('bulkHistoryDelete')?.remove();
    if (buildMenuItem()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (buildMenuItem() || tries >= 30) clearInterval(timer);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
