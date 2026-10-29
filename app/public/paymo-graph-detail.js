(() => {
  let activeFilter = null;
  let swipe = null;

  const validMonth = (value) => /^\d{4}-\d{2}$/.test(String(value || ''));
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const usageDateOf = (expense) => expense?.usageDate || expense?.usage_date || expense?.date || '';
  const isPaid = (expense) => expense?.paid === true || expense?.paid === 1 || expense?.paid === '1';
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function formatMonth(value) {
    if (!validMonth(value)) return '';
    const [year, month] = value.split('-');
    return `${year}年${Number(month)}月`;
  }

  function formatDate(value) {
    if (!validDate(value)) return '日付なし';
    const [year, month, day] = value.split('-');
    return `${year}/${Number(month)}/${Number(day)}`;
  }

  function payeeColor(name) {
    return PAYEES.find((payee) => payee.name === name)?.color || '#999999';
  }

  function billingPartsOf(expense) {
    const raw = Array.isArray(expense?.installments) ? expense.installments : [];
    const parts = raw.slice(0, 3)
      .map((part) => ({ date: String(part?.date || ''), amount: Number(part?.amount || 0) }))
      .filter((part) => validDate(part.date) && part.amount > 0);
    if (parts.length && parts.reduce((sum, part) => sum + part.amount, 0) === Number(expense?.amount || 0)) return parts;
    return [{ date: String(expense?.date || ''), amount: Number(expense?.amount || 0) }];
  }

  function usageBreakdown(month) {
    const totals = new Map();
    expenses.forEach((expense) => {
      const usageDate = usageDateOf(expense);
      if (!usageDate || ym(usageDate) !== month) return;
      const name = String(expense.payee || 'その他');
      const amount = Number(expense.amount || 0);
      if (amount) totals.set(name, (totals.get(name) || 0) + amount);
    });
    return orderedBreakdown(totals);
  }

  function billingBreakdown(month) {
    const totals = new Map();
    expenses.filter((expense) => !isPaid(expense)).forEach((expense) => {
      const name = String(expense.payee || 'その他');
      const amount = billingPartsOf(expense)
        .filter((part) => part.date && ym(part.date) === month)
        .reduce((sum, part) => sum + part.amount, 0);
      if (amount) totals.set(name, (totals.get(name) || 0) + amount);
    });
    return orderedBreakdown(totals);
  }

  function orderedBreakdown(totals) {
    const result = [];
    const seen = new Set();
    PAYEES.forEach((payee) => {
      const amount = totals.get(payee.name) || 0;
      if (!amount) return;
      result.push({ name: payee.name, amount });
      seen.add(payee.name);
    });
    totals.forEach((amount, name) => {
      if (!amount || seen.has(name)) return;
      result.push({ name, amount });
    });
    return result;
  }

  function ensureStyle() {
    if (document.getElementById('paymo-graph-detail-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-graph-detail-style';
    style.textContent = `
      #graphChart .stack-segment,#homeChart .stack-segment{cursor:pointer;touch-action:manipulation}
      .paymo-graph-detail{position:fixed;inset:0;z-index:500;display:flex;flex-direction:column;background:var(--page-bg,#000);color:var(--text,#fff);transform:translate3d(100%,0,0);transition:transform 260ms cubic-bezier(.22,.72,.24,1);will-change:transform;visibility:hidden;overflow:hidden}
      .paymo-graph-detail.is-visible{visibility:visible}
      .paymo-graph-detail.is-open{transform:translate3d(0,0,0)}
      .paymo-graph-detail-head{flex:0 0 auto;display:grid;grid-template-columns:72px minmax(0,1fr) 72px;align-items:center;min-height:54px;padding:calc(env(safe-area-inset-top) + 6px) 16px 6px;border-bottom:1px solid var(--line);background:var(--page-bg,#000)}
      .paymo-graph-detail-back{justify-self:start;border:0;padding:8px 8px 8px 0;background:transparent;color:var(--accent,#E085FF);font:inherit;font-size:15px;font-weight:800}
      .paymo-graph-detail-title{min-width:0;text-align:center;font-size:17px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .paymo-graph-detail-body{flex:1 1 auto;overflow:auto;-webkit-overflow-scrolling:touch;padding:18px 16px calc(28px + env(safe-area-inset-bottom));scrollbar-width:none}
      .paymo-graph-detail-body::-webkit-scrollbar{display:none}
      .paymo-graph-detail-meta{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:14px}
      .paymo-graph-detail-month{font-size:13px;font-weight:800;color:var(--muted)}
      .paymo-graph-detail-total{font-size:25px;font-weight:950;letter-spacing:-.02em}
      .paymo-graph-detail-count{font-size:12px;font-weight:800;color:var(--muted);white-space:nowrap}
      .paymo-graph-detail-list{border-top:1px solid var(--line)}
      .paymo-graph-detail-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid var(--line)}
      .paymo-graph-detail-row-left{min-width:0;display:flex;flex-direction:column;gap:5px}
      .paymo-graph-detail-date{font-size:12px;font-weight:700;color:var(--muted)}
      .paymo-graph-detail-name{font-size:15px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .paymo-graph-detail-name .dot{display:inline-block;margin-right:7px}
      .paymo-graph-detail-amount{font-size:17px;font-weight:950;white-space:nowrap;text-align:right}
      .paymo-graph-detail-paid{margin-top:2px;font-size:11px;font-weight:800;color:#22a559}
      .paymo-graph-detail-empty{padding:26px 0;text-align:center;color:var(--muted);font-size:13px;font-weight:700}
      body.paymo-graph-detail-open{overflow:hidden!important}
    `;
    document.head.appendChild(style);
  }

  function ensurePage() {
    ensureStyle();
    let page = document.getElementById('paymoGraphDetail');
    if (page) return page;
    page = document.createElement('section');
    page.id = 'paymoGraphDetail';
    page.className = 'paymo-graph-detail';
    page.setAttribute('data-no-page-swipe', 'true');
    page.innerHTML = `
      <div class="paymo-graph-detail-head">
        <button type="button" id="paymoGraphDetailBack" class="paymo-graph-detail-back">‹ 戻る</button>
        <div id="paymoGraphDetailTitle" class="paymo-graph-detail-title">履歴</div>
        <div></div>
      </div>
      <div class="paymo-graph-detail-body">
        <div class="paymo-graph-detail-meta">
          <div><div id="paymoGraphDetailMonth" class="paymo-graph-detail-month"></div><div id="paymoGraphDetailTotal" class="paymo-graph-detail-total"></div></div>
          <div id="paymoGraphDetailCount" class="paymo-graph-detail-count"></div>
        </div>
        <div id="paymoGraphDetailRows" class="paymo-graph-detail-list"></div>
      </div>`;
    document.body.appendChild(page);
    page.querySelector('#paymoGraphDetailBack')?.addEventListener('click', closePage);
    bindBackSwipe(page);
    return page;
  }

  function filteredUsageRows(month, payee) {
    return expenses
      .map((expense, index) => ({ expense, index, date: usageDateOf(expense), amount: Number(expense.amount || 0) }))
      .filter(({ expense, date }) => date && ym(date) === month && String(expense.payee || 'その他') === payee)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.index - a.index);
  }

  function filteredBillingRows(month, payee) {
    const rows = [];
    expenses.forEach((expense, index) => {
      if (isPaid(expense) || String(expense.payee || 'その他') !== payee) return;
      billingPartsOf(expense).forEach((part, partIndex) => {
        if (!part.date || ym(part.date) !== month) return;
        rows.push({ expense, index, partIndex, date: part.date, amount: Number(part.amount || 0) });
      });
    });
    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.index - a.index || b.partIndex - a.partIndex);
  }

  function renderPage(month, payee, mode = 'usage') {
    const page = ensurePage();
    const rows = mode === 'billing' ? filteredBillingRows(month, payee) : filteredUsageRows(month, payee);
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    page.querySelector('#paymoGraphDetailTitle').textContent = payee;
    page.querySelector('#paymoGraphDetailMonth').textContent = `${formatMonth(month)}の${mode === 'billing' ? '支払履歴' : '履歴'}`;
    page.querySelector('#paymoGraphDetailTotal').textContent = yen(total);
    page.querySelector('#paymoGraphDetailCount').textContent = `${rows.length}件`;

    const rowsEl = page.querySelector('#paymoGraphDetailRows');
    if (!rows.length) {
      rowsEl.innerHTML = '<div class="paymo-graph-detail-empty">該当する履歴はありません。</div>';
      return page;
    }

    rowsEl.innerHTML = rows.map(({ expense, date, amount }) => {
      const paid = mode === 'usage' && isPaid(expense);
      return `<div class="paymo-graph-detail-row">
        <div class="paymo-graph-detail-row-left">
          <div class="paymo-graph-detail-date">${escapeHtml(formatDate(date))}</div>
          <div class="paymo-graph-detail-name"><i class="dot" style="background:${payeeColor(payee)}"></i>${escapeHtml(payee)}</div>
          ${paid ? '<div class="paymo-graph-detail-paid">支払い済</div>' : ''}
        </div>
        <div class="paymo-graph-detail-amount">${yen(Number(amount || 0))}</div>
      </div>`;
    }).join('');
    return page;
  }

  function openPage(month, payee, mode = 'usage') {
    activeFilter = { month, payee, mode };
    const page = renderPage(month, payee, mode);
    page.classList.add('is-visible');
    page.style.transition = 'none';
    page.style.transform = 'translate3d(100%,0,0)';
    document.body.classList.add('paymo-graph-detail-open');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      page.style.transition = '';
      page.classList.add('is-open');
      page.style.transform = '';
      page.querySelector('.paymo-graph-detail-body').scrollTop = 0;
    }));
  }

  function closePage() {
    const page = document.getElementById('paymoGraphDetail');
    if (!page?.classList.contains('is-visible')) return;
    page.classList.remove('is-open');
    page.style.transition = 'transform 230ms cubic-bezier(.22,.72,.24,1)';
    page.style.transform = 'translate3d(100%,0,0)';
    setTimeout(() => {
      page.classList.remove('is-visible');
      page.style.transition = '';
      page.style.transform = '';
      document.body.classList.remove('paymo-graph-detail-open');
      activeFilter = null;
    }, 240);
  }

  function bindBackSwipe(page) {
    page.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > 35) return;
      swipe = { startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, lastAt: performance.now(), distance: 0, velocityX: 0, engaged: false };
    }, { passive:true });

    page.addEventListener('touchmove', (event) => {
      if (!swipe || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - swipe.startX;
      const dy = touch.clientY - swipe.startY;
      const now = performance.now();
      const dt = Math.max(1, now - swipe.lastAt);
      swipe.velocityX = (touch.clientX - swipe.lastX) / dt;
      swipe.lastX = touch.clientX;
      swipe.lastAt = now;
      if (!swipe.engaged) {
        if (dx < 8 || dx < Math.abs(dy) * 1.25) return;
        swipe.engaged = true;
        page.style.transition = 'none';
      }
      swipe.distance = Math.max(0, dx);
      page.style.transform = `translate3d(${swipe.distance}px,0,0)`;
      if (event.cancelable) event.preventDefault();
    }, { passive:false });

    page.addEventListener('touchend', () => {
      const current = swipe;
      swipe = null;
      if (!current?.engaged) return;
      const commit = current.distance > Math.min(130, page.offsetWidth * .28) || (current.distance > 45 && current.velocityX > .45);
      if (commit) closePage();
      else {
        page.style.transition = 'transform 220ms cubic-bezier(.22,.72,.24,1)';
        page.style.transform = 'translate3d(0,0,0)';
        setTimeout(() => {
          if (page.classList.contains('is-open')) { page.style.transition = ''; page.style.transform = ''; }
        }, 230);
      }
    }, { passive:true });

    page.addEventListener('touchcancel', () => {
      swipe = null;
      if (!page.classList.contains('is-open')) return;
      page.style.transition = 'transform 220ms cubic-bezier(.22,.72,.24,1)';
      page.style.transform = 'translate3d(0,0,0)';
      setTimeout(() => { page.style.transition = ''; page.style.transform = ''; }, 230);
    }, { passive:true });
  }

  function chartClick(event) {
    const segment = event.target?.closest?.('#graphChart .stack-segment,#homeChart .stack-segment');
    if (!segment) return;
    const chart = segment.closest('#graphChart,#homeChart');
    const bar = segment.closest('.bar-wrap');
    if (!bar || !chart) return;

    const bars = Array.from(chart.querySelectorAll('.bar-wrap'));
    const barIndex = bars.indexOf(bar);
    if (barIndex < 0) return;
    const center = Math.floor(bars.length / 2);
    const month = monthKey(barIndex - center);
    const mode = chart.id === 'homeChart' ? 'billing' : 'usage';
    const breakdown = mode === 'billing' ? billingBreakdown(month) : usageBreakdown(month);
    const segmentIndex = Array.from(segment.parentElement?.querySelectorAll('.stack-segment') || []).indexOf(segment);
    const item = breakdown[segmentIndex];
    if (!item) return;

    event.preventDefault();
    event.stopPropagation();
    openPage(month, item.name, mode);
  }

  document.addEventListener('click', chartClick, true);

  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) {
    render = function (...args) {
      const result = previousRender(...args);
      if (activeFilter) renderPage(activeFilter.month, activeFilter.payee, activeFilter.mode);
      return result;
    };
  }

  ensureStyle();
})();
