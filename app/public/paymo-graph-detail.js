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

  function usageGroups(month, descending = true) {
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
    const order = orderedNames(new Set(groups.keys()));
    return order.map((name) => {
      const rows = groups.get(name).sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.index - a.index);
      return { name, rows, total: rows.reduce((sum, row) => sum + row.amount, 0) };
    }).sort((a, b) => (descending ? b.total - a.total : a.total - b.total) || order.indexOf(a.name) - order.indexOf(b.name));
  }

  function usageDateGroups(month, descending = true) {
    const groups = new Map();
    expenses.forEach((expense, index) => {
      const date = usageDateOf(expense);
      if (!validDate(date) || ym(date) !== month) return;
      const amount = Number(expense.amount || 0);
      if (!amount) return;
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push({ expense, index, date, amount });
    });
    return Array.from(groups, ([date, rows]) => ({
      date,
      rows: rows.sort((a, b) => b.index - a.index),
      total: rows.reduce((sum, row) => sum + row.amount, 0)
    })).sort((a, b) => descending ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
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
      .paymo-graph-detail-head{flex:0 0 auto;display:grid;grid-template-columns:96px minmax(0,1fr) 96px;align-items:center;min-height:54px;padding:calc(env(safe-area-inset-top) + 6px) 16px 6px;border-bottom:1px solid var(--line);background:var(--page-bg,#000)}
      .paymo-graph-detail-back{justify-self:start;border:0;padding:8px 8px 8px 0;background:transparent;color:var(--accent,#E085FF);font:inherit;font-size:15px;font-weight:800}
      .paymo-graph-detail-title{min-width:0;text-align:center;font-size:17px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .paymo-graph-detail-actions{display:flex;align-items:center;justify-content:flex-end;gap:2px}
      .paymo-graph-detail-actions[hidden]{display:none!important}
      .paymo-graph-detail-action{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border:0;border-radius:11px;background:transparent;color:var(--accent,#B9F486);font:inherit;font-size:23px;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .paymo-graph-detail-action:active{background:var(--surface,#101310)}
      #paymoGraphDetailToggleView{color:var(--accent,#B9F486)}
      .paymo-graph-detail-rotate-icon{display:block;flex:none;width:28px;height:28px;overflow:visible}
      .paymo-graph-detail-action:focus-visible{outline:2px solid var(--accent,#B9F486);outline-offset:1px}
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
      .paymo-graph-detail-row{display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid color-mix(in srgb,var(--line) 55%,transparent)}
      .paymo-graph-detail-row:last-child{border-bottom:0}
      .paymo-graph-detail-date{width:42px;flex:0 0 42px;font-size:13px;font-weight:750;color:var(--muted);white-space:nowrap}
      .paymo-graph-detail-paid{font-size:10px;font-weight:800;color:#22a559;white-space:nowrap}
      .paymo-graph-detail-amount{font-size:15px;font-weight:900;white-space:nowrap;text-align:left}
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
        <div id="paymoGraphDetailActions" class="paymo-graph-detail-actions" hidden>
          <button type="button" id="paymoGraphDetailToggleView" class="paymo-graph-detail-action" aria-label="支出日別表示に切り替え" title="表示切替"><svg class="paymo-graph-detail-rotate-icon" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="5.8" stroke-linecap="round"><path d="M11.8 25.4C15.2 14.1 22.6 9.4 32.2 9.4C41.9 9.4 49 15.2 51.5 23.6"/><path d="M52.2 38.4C49 49.8 41.6 54.7 32 54.7C22.1 54.7 15.1 49 12.3 40.6"/></g><g fill="currentColor" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"><path d="M44.5 27.3 56.4 21.6 53.8 33.5Z"/><path d="M7.8 42.5 10.5 31.3 21.5 38.1Z"/></g></svg></button>
          <button type="button" id="paymoGraphDetailToggleSort" class="paymo-graph-detail-action" aria-label="少ない順に並び替え" title="並び順">⇅</button>
        </div>
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
    page.querySelector('#paymoGraphDetailToggleView')?.addEventListener('click', () => {
      if (!activeFilter || activeFilter.mode !== 'usage') return;
      activeFilter.grouping = activeFilter.grouping === 'date' ? 'item' : 'date';
      renderPage(activeFilter.month, activeFilter.mode);
      page.querySelector('.paymo-graph-detail-body').scrollTop = 0;
    });
    page.querySelector('#paymoGraphDetailToggleSort')?.addEventListener('click', () => {
      if (!activeFilter || activeFilter.mode !== 'usage') return;
      const key = activeFilter.grouping === 'date' ? 'dateDescending' : 'itemDescending';
      activeFilter[key] = !activeFilter[key];
      renderPage(activeFilter.month, activeFilter.mode);
      page.querySelector('.paymo-graph-detail-body').scrollTop = 0;
    });
    bindBackSwipe(page);
    return page;
  }

  function renderPage(month, mode = 'usage') {
    const page = ensurePage();
    const options = activeFilter?.month === month && activeFilter?.mode === mode ? activeFilter : {};
    const dateGrouped = mode === 'usage' && options.grouping === 'date';
    const groups = mode === 'billing'
      ? billingGroups(month)
      : dateGrouped ? usageDateGroups(month, options.dateDescending !== false) : usageGroups(month, options.itemDescending !== false);
    const total = groups.reduce((sum, group) => sum + group.total, 0);

    page.dataset.grouping = dateGrouped ? 'date' : 'item';
    const actions = page.querySelector('#paymoGraphDetailActions');
    actions.hidden = mode !== 'usage';
    page.querySelector('#paymoGraphDetailToggleView').setAttribute('aria-label', dateGrouped ? '項目別表示に切り替え' : '支出日別表示に切り替え');
    const descending = dateGrouped ? options.dateDescending !== false : options.itemDescending !== false;
    const nextSortLabel = dateGrouped
      ? descending ? '古い日付順に並び替え' : '新しい日付順に並び替え'
      : descending ? '合計額が少ない順に並び替え' : '合計額が多い順に並び替え';
    page.querySelector('#paymoGraphDetailToggleSort').setAttribute('aria-label', nextSortLabel);
    page.querySelector('#paymoGraphDetailTitle').textContent = mode === 'billing' ? '月別支払額' : '支出推移';
    page.querySelector('#paymoGraphDetailMonth').textContent = shortMonth(month);
    page.querySelector('#paymoGraphDetailTotal').textContent = yen(total);

    const groupsEl = page.querySelector('#paymoGraphDetailGroups');
    if (!groups.length) {
      groupsEl.innerHTML = '<div class="paymo-graph-detail-empty">該当する履歴はありません。</div>';
    } else {
      groupsEl.innerHTML = groups.map((group) => `
        <section class="paymo-graph-detail-group">
          <div class="paymo-graph-detail-group-head">
            <div class="paymo-graph-detail-group-name">${dateGrouped ? escapeHtml(formatDate(group.date)) : `<i class="dot" style="background:${payeeColor(group.name)}"></i>${escapeHtml(group.name)}`}</div>
            <div class="paymo-graph-detail-group-total">${yen(group.total)}</div>
          </div>
          <div>
            ${group.rows.map((row) => `
              <div class="paymo-graph-detail-row"${dateGrouped ? ` data-expense-index="${row.index}"` : ''}>
                <span class="paymo-graph-detail-date">${escapeHtml(formatDate(row.date))}</span>
                <div class="paymo-graph-detail-amount">${yen(row.amount)}</div>
                ${mode === 'usage' && isPaid(row.expense) ? '<span class="paymo-graph-detail-paid">支払い済</span>' : ''}
              </div>`).join('')}
          </div>
        </section>`).join('');
    }
    document.dispatchEvent(new CustomEvent('paymo-graph-detail-rendered'));
    return page;
  }

  function openPage(month, mode = 'usage') {
    activeFilter = { month, mode, grouping: 'item', itemDescending: true, dateDescending: true };
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
