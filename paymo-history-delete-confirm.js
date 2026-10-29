(() => {
  let activeExpenseId = '';
  let deleteResolve = null;
  const SHADE_ALPHA = 0.58;

  function ensureStyle() {
    if (document.getElementById('paymo-history-delete-confirm-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-history-delete-confirm-style';
    style.textContent = `
      .history-delete-confirm-backdrop{position:fixed;inset:0;z-index:120;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0);transition:background-color .28s ease;overscroll-behavior:none}
      .history-delete-confirm-backdrop[hidden]{display:none!important}
      .history-delete-confirm-backdrop.open{background:rgba(0,0,0,.58)}
      .history-delete-confirm-sheet{width:min(100%,430px);background:var(--surface,#f7f7f5);color:var(--page-fg,#111);border-radius:30px 30px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -14px 42px rgba(0,0,0,.34);transform:translate3d(0,105%,0);transition:transform .32s cubic-bezier(.22,.72,.24,1);box-sizing:border-box;will-change:transform;touch-action:pan-y}
      .history-delete-confirm-backdrop.open .history-delete-confirm-sheet{transform:translate3d(0,0,0)}
      .history-delete-confirm-handle{width:44px;height:5px;background:var(--theme-muted,#999);opacity:.55;border-radius:99px;margin:0 auto 16px}
      .history-delete-confirm-title{font-size:26px;line-height:1.2;font-weight:900;letter-spacing:-.4px;margin:0 0 8px}
      .history-delete-confirm-message{font-size:14px;font-weight:700;line-height:1.6;margin:0;color:var(--theme-muted,#777)}
      .history-delete-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:26px}
      .history-delete-confirm-button{min-height:52px;border-radius:16px;padding:13px 10px;font-weight:900;font-size:15px}
      .history-delete-confirm-delete{background:color-mix(in srgb,#E63946 14%,var(--surface,#f7f7f5));color:#E63946;border:1px solid color-mix(in srgb,#E63946 32%,transparent)}
      .history-delete-confirm-cancel{background:var(--page-bg,#e9e9e6);color:var(--page-fg,#111);border:1px solid var(--theme-line,#d7d7d4)}
    `;
    document.head.appendChild(style);
  }

  function finish(result) {
    const resolve = deleteResolve;
    deleteResolve = null;
    if (resolve) resolve(Boolean(result));
  }

  function animateClose(result) {
    const backdrop = document.getElementById('historyDeleteConfirmBackdrop');
    const sheet = backdrop?.querySelector('.history-delete-confirm-sheet');
    if (!backdrop || !sheet || backdrop.dataset.closing === '1') return finish(result);
    backdrop.dataset.closing = '1';
    sheet.style.transition = 'transform .26s cubic-bezier(.4,0,1,1)';
    sheet.style.transform = `translate3d(0,${sheet.offsetHeight + 36}px,0)`;
    backdrop.style.transition = 'background-color .3s ease';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0)';
    const done = () => {
      backdrop.hidden = true;
      backdrop.classList.remove('open');
      backdrop.style.backgroundColor = '';
      backdrop.dataset.closing = '';
      sheet.style.transition = '';
      sheet.style.transform = '';
      finish(result);
    };
    sheet.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 340);
  }

  function bindDrag(backdrop, sheet) {
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let tracking = false;
    let mode = null;
    const LOCK = 8;

    const reset = () => {
      sheet.style.transition = 'transform .28s cubic-bezier(.22,.72,.24,1)';
      sheet.style.transform = 'translate3d(0,0,0)';
      backdrop.style.transition = 'background-color .28s ease';
      backdrop.style.backgroundColor = `rgba(0,0,0,${SHADE_ALPHA})`;
    };

    sheet.addEventListener('touchstart', (event) => {
      if (backdrop.dataset.closing === '1' || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = lastY = touch.clientY;
      lastTime = performance.now();
      velocityY = 0;
      tracking = true;
      mode = null;
    }, { passive: true });

    sheet.addEventListener('touchmove', (event) => {
      if (!tracking || backdrop.dataset.closing === '1' || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (!mode) {
        if (dy > LOCK && ay > ax * 1.05) mode = 'drag';
        else if (ay > LOCK || ax > LOCK) mode = 'ignore';
      }
      if (mode !== 'drag') return;
      event.preventDefault();
      const now = performance.now();
      const distance = Math.max(0, dy);
      const dt = Math.max(1, now - lastTime);
      velocityY = (touch.clientY - lastY) / dt;
      lastY = touch.clientY;
      lastTime = now;
      sheet.style.transition = 'none';
      backdrop.style.transition = 'none';
      sheet.style.transform = `translate3d(0,${distance}px,0)`;
      const progress = Math.min(1, distance / Math.max(180, sheet.offsetHeight * .8));
      backdrop.style.backgroundColor = `rgba(0,0,0,${(SHADE_ALPHA * (1 - progress)).toFixed(3)})`;
    }, { passive: false });

    sheet.addEventListener('touchend', () => {
      if (!tracking || backdrop.dataset.closing === '1') return;
      tracking = false;
      const dy = Math.max(0, lastY - startY);
      if (mode === 'drag' && (dy >= 90 || (dy >= 42 && velocityY > .55))) return animateClose(false);
      if (mode === 'drag') reset();
    }, { passive: true });

    sheet.addEventListener('touchcancel', () => {
      tracking = false;
      if (mode === 'drag' && backdrop.dataset.closing !== '1') reset();
    }, { passive: true });
  }

  function ensureUi() {
    ensureStyle();
    if (document.getElementById('historyDeleteConfirmBackdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'historyDeleteConfirmBackdrop';
    backdrop.className = 'history-delete-confirm-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="history-delete-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="historyDeleteConfirmTitle">
        <div class="history-delete-confirm-handle"></div>
        <h3 id="historyDeleteConfirmTitle" class="history-delete-confirm-title">この履歴を削除しますか？</h3>
        <p class="history-delete-confirm-message">この操作は取り消せません。</p>
        <div class="history-delete-confirm-actions">
          <button id="historyDeleteConfirmDelete" type="button" class="history-delete-confirm-button history-delete-confirm-delete">削除</button>
          <button id="historyDeleteConfirmCancel" type="button" class="history-delete-confirm-button history-delete-confirm-cancel">キャンセル</button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    const sheet = backdrop.querySelector('.history-delete-confirm-sheet');
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) animateClose(false); });
    document.getElementById('historyDeleteConfirmCancel').onclick = () => animateClose(false);
    document.getElementById('historyDeleteConfirmDelete').onclick = () => animateClose(true);
    if (sheet) bindDrag(backdrop, sheet);
  }

  function askDelete() {
    ensureUi();
    const backdrop = document.getElementById('historyDeleteConfirmBackdrop');
    if (!backdrop || deleteResolve) return Promise.resolve(false);
    backdrop.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('open')));
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
