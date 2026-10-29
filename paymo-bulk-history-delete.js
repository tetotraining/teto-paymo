(() => {
  const STORAGE_KEY = 'ready-expenses-v1';
  const CLIENT_KEY_STORAGE = 'paymo-d1-client-key-v1';
  const PENDING_DELETE_KEY = 'paymo-pending-delete-v1';
  const SHADE_ALPHA = 0.58;

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
      .bulk-history-shade{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,0);display:flex;justify-content:center;align-items:flex-end;transition:background-color .28s ease;overscroll-behavior:none}
      .bulk-history-shade.open{background:rgba(0,0,0,.58)}
      .bulk-history-sheet{width:min(100%,430px);max-height:min(82dvh,760px);overflow:auto;background:var(--surface);color:var(--page-fg);border-radius:30px 30px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -14px 42px rgba(0,0,0,.34);transform:translate3d(0,105%,0);transition:transform .32s cubic-bezier(.22,.72,.24,1);box-sizing:border-box;scrollbar-width:none;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;will-change:transform}
      .bulk-history-sheet::-webkit-scrollbar{display:none}
      .bulk-history-shade.open .bulk-history-sheet{transform:translate3d(0,0,0)}
      .bulk-history-handle{width:44px;height:5px;background:var(--theme-muted);opacity:.55;border-radius:99px;margin:0 auto 14px}
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
        headers: { 'content-type': 'application/json', 'x-paymo-key': key },
        body: JSON.stringify({ ids }),
        cache: 'no-store'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  function animateClose(shade, distance) {
    const sheet = shade?.querySelector('.bulk-history-sheet');
    if (!shade || !sheet || shade.dataset.closing === '1') return;
    shade.dataset.closing = '1';
    sheet.style.transition = 'transform .26s cubic-bezier(.4,0,1,1)';
    sheet.style.transform = `translate3d(0,${Math.max(distance || 0, sheet.offsetHeight + 36)}px,0)`;
    shade.style.transition = 'background-color .32s ease';
    shade.style.backgroundColor = 'rgba(0,0,0,0)';
    const done = () => shade.remove();
    sheet.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 360);
  }

  function closeFlow() {
    const shade = document.getElementById('bulkHistoryFlowShade');
    if (!shade) return;
    animateClose(shade);
  }

  function bindDragToClose(shade, sheet) {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let tracking = false;
    let mode = null;
    const LOCK = 8;
    const CLOSE_Y = 105;

    const reset = () => {
      sheet.style.transition = 'transform .28s cubic-bezier(.22,.72,.24,1)';
      sheet.style.transform = 'translate3d(0,0,0)';
      shade.style.transition = 'background-color .28s ease';
      shade.style.backgroundColor = `rgba(0,0,0,${SHADE_ALPHA})`;
    };

    sheet.addEventListener('touchstart', (event) => {
      if (shade.dataset.closing === '1' || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = lastX = touch.clientX;
      startY = lastY = touch.clientY;
      lastTime = performance.now();
      velocityY = 0;
      tracking = true;
      mode = null;
    }, { passive: true });

    sheet.addEventListener('touchmove', (event) => {
      if (!tracking || shade.dataset.closing === '1' || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const now = performance.now();
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);

      if (!mode) {
        if (dy > LOCK && ay > ax * 1.05 && sheet.scrollTop <= 0) mode = 'drag';
        else if (ay > LOCK || ax > LOCK) mode = 'scroll';
      }
      if (mode !== 'drag') {
        lastX = touch.clientX;
        lastY = touch.clientY;
        lastTime = now;
        return;
      }

      event.preventDefault();
      const distance = Math.max(0, dy);
      const dt = Math.max(1, now - lastTime);
      velocityY = (touch.clientY - lastY) / dt;
      lastX = touch.clientX;
      lastY = touch.clientY;
      lastTime = now;

      sheet.style.transition = 'none';
      shade.style.transition = 'none';
      sheet.style.transform = `translate3d(0,${distance}px,0)`;
      const fadeRange = Math.max(220, sheet.offsetHeight * .72);
      const progress = Math.min(1, distance / fadeRange);
      shade.style.backgroundColor = `rgba(0,0,0,${(SHADE_ALPHA * (1 - progress)).toFixed(3)})`;
    }, { passive: false });

    sheet.addEventListener('touchend', () => {
      if (!tracking || shade.dataset.closing === '1') return;
      tracking = false;
      const dy = Math.max(0, lastY - startY);
      if (mode === 'drag' && (dy >= CLOSE_Y || (dy >= 48 && velocityY > .55))) {
        animateClose(shade, sheet.offsetHeight + 40);
        return;
      }
      if (mode === 'drag') reset();
    }, { passive: true });

    sheet.addEventListener('touchcancel', () => {
      if (shade.dataset.closing === '1') return;
      tracking = false;
      if (mode === 'drag') reset();
    }, { passive: true });
  }

  function bindShade(shade) {
    shade.onclick = (event) => { if (event.target === shade) closeFlow(); };
    shade.querySelector('.bulk-history-close')?.addEventListener('click', closeFlow);
    const sheet = shade.querySelector('.bulk-history-sheet');
    if (sheet) bindDragToClose(shade, sheet);
  }

  function mountSheet(innerHtml) {
    document.getElementById('bulkHistoryFlowShade')?.remove();
    const shade = document.createElement('div');
    shade.id = 'bulkHistoryFlowShade';
    shade.className = 'bulk-history-shade';
    shade.innerHTML = `<section class="bulk-history-sheet"><div class="bulk-history-handle"></div>${innerHtml}</section>`;
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
    if (!targets.length) return openPicker();
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
    if (!targets.length) return closeFlow();

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
