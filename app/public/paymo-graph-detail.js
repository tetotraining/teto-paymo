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

  function shortMonth(value) {
    if (!validMonth(value)) return '';
    return `${Number(value.split('-')[1])}月`;
  }

  function formatDate(value) {
    if (!validDate(value)) return '日付なし';
    const [, month, day] = value.split('-');
    return `${Number(month)}/${Number(day)}`;
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

  function orderedNames(names) {
    const known = PAYEES.map((payee) => payee.name).filter((name) => names.has(name));
    const rest = Array.from(names).filter((name) => !known.includes(name)).sort((a, b) => a.localeCompare(b, 'ja'));
    return [...known, ...rest];
  }

  function usageGroups(month) {
    const groups = new Map();
    expenses.forEach((expense, index) => {
      const date = usageDateOf(expense);
      if (!date || ym(date) !== month) return;
      const name = String(expense.payee || 'その他');
      const amount = Number(expense.amount || 0);
      if (!amount) return;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push({ expense, index, date, amount });
    });
    return orderedNames(new Set(groups.keys())).map((name) => {
      const rows = groups.get(name).sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.index - a.index);
      return { name, rows, total: rows.reduce((sum, row) => sum + row.amount, 0) };
    });
  }

  function billingGroups(month) {
    const groups = new Map();
    expenses.forEach((expense, index) => {
      if (isPaid(expense)) return;
      const name = String(expense.payee || 'その他');
      billingPartsOf(expense).forEach((part, partIndex) => {
        if (!part.date || ym(part.date) !== month || !part.amount) return;
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push({ expense, index, partIndex, date: part.date, amount: Number(part.amount || 0) });
      });
    });
    return orderedNames(new Set(groups.keys())).map((name) => {
      const rows = groups.get(name).sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.index - a.index || b.partIndex - a.partIndex);
      return { name, rows, total: rows.reduce((sum, row) => sum + row.amount, 0) };
    });
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
      .paymo-graph-detail-summary{display:flex;align-items:baseline;gap:10px;margin-bottom:22px}
      .paymo-graph-detail-month{font-size:18px;font-weight:900;white-space:nowrap}
      .paymo-graph-detail-total{font-size:27px;font-weight:950;letter-spacing:-.02em}
      .paymo-graph-detail-groups{display:flex;flex-direction:column;gap:24px}
      .paymo-graph-detail-group{min-width:0}
      .paymo-graph-detail-group-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:8px;border-bottom:1px solid var(--line)}
      .paymo-graph-detail-group-name{min-width:0;font-size:16px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .paymo-graph-detail-group-name .dot{display:inline-block;margin-right:7px}
      .paymo-graph-detail-group-total{font-size:16px;font-weight:950;white-space:nowrap}
      .paymo-graph-detail-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid color-mix(in srgb,var(--line) 55%,transparent)}
      .paymo-graph-detail-row:last-child{border-bottom:0}
      .paymo-graph-detail-row-left{min-width:0;display:flex;align-items:center;gap:8px}
      .paymo-graph-detail-date{font-size:13px;font-weight:750;color:var(--muted);white-space:nowrap}
      .paymo-graph-detail-paid{font-size:10px;font-weight:800;color:#22a559;white-space:nowrap}
      .paymo-graph-detail-amount{font-size:15px;font-weight:900;white-space:nowrap;text-align:right}
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
        <div class="paymo-graph-detail-summary">
          <div id="paymoGraphDetailMonth" class="paymo-graph-detail-month"></div>
          <div id="paymoGraphDetailTotal" class="paymo-graph-detail-total"></div>
        </div>
        <div id="paymoGraphDetailGroups" class="paymo-graph-detail-groups"></div>
      </div>`;
    document.body.appendChild(page);
    page.querySelector('#paymoGraphDetailBack')?.addEventListener('click', closePage);
    bindBackSwipe(page);
    return page;
  }

  function renderPage(month, mode = 'usage') {
    const page = ensurePage();
    const groups = mode === 'billing' ? billingGroups(month) : usageGroups(month);
    const total = groups.reduce((sum, group) => sum + group.total, 0);

    page.querySelector('#paymoGraphDetailTitle').textContent = mode === 'billing' ? '月別支払額' : '支出推移';
    page.querySelector('#paymoGraphDetailMonth').textContent = shortMonth(month);
    page.querySelector('#paymoGraphDetailTotal').textContent = yen(total);

    const groupsEl = page.querySelector('#paymoGraphDetailGroups');
    if (!groups.length) {
      groupsEl.innerHTML = '<div class="paymo-graph-detail-empty">該当する履歴はありません。</div>';
      return page;
    }

    groupsEl.innerHTML = groups.map((group) => `
      <section class="paymo-graph-detail-group">
        <div class="paymo-graph-detail-group-head">
          <div class="paymo-graph-detail-group-name"><i class="dot" style="background:${payeeColor(group.name)}"></i>${escapeHtml(group.name)}</div>
          <div class="paymo-graph-detail-group-total">${yen(group.total)}</div>
        </div>
        <div>
          ${group.rows.map((row) => `
            <div class="paymo-graph-detail-row">
              <div class="paymo-graph-detail-row-left">
                <span class="paymo-graph-detail-date">${escapeHtml(formatDate(row.date))}</span>
                ${mode === 'usage' && isPaid(row.expense) ? '<span class="paymo-graph-detail-paid">支払い済</span>' : ''}
              </div>
              <div class="paymo-graph-detail-amount">${yen(row.amount)}</div>
            </div>`).join('')}
        </div>
      </section>`).join('');
    return page;
  }

  function openPage(month, mode = 'usage') {
    activeFilter = { month, mode };
    const page = renderPage(month, mode);
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

    event.preventDefault();
    event.stopPropagation();
    openPage(month, mode);
  }

  document.addEventListener('click', chartClick, true);

  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) {
    render = function (...args) {
      const result = previousRender(...args);
      if (activeFilter) renderPage(activeFilter.month, activeFilter.mode);
      return result;
    };
  }

  ensureStyle();
})();
