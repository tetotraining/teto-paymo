(() => {
  let activeItem = null;
  let swipe = null;

  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const usageDateOf = (expense) => expense?.usageDate || expense?.usage_date || expense?.date || '';
  const isPaid = (expense) => expense?.paid === true || expense?.paid === 1 || expense?.paid === '1';
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function source() {
    if (Array.isArray(window.expenses)) return window.expenses;
    try { return JSON.parse(localStorage.getItem('ready-expenses-v1') || '[]'); } catch (_) { return []; }
  }

  function shortDate(value) {
    if (!validDate(value)) return '--/--';
    const [, month, day] = String(value).split('-');
    return `${Number(month)}/${Number(day)}`;
  }

  function payeeColor(name) {
    try {
      const saved = JSON.parse(localStorage.getItem('paymo_payees_v1') || '[]');
      const found = Array.isArray(saved) ? saved.find((item) => String(item?.name || '') === name) : null;
      if (found?.color) return found.color;
    } catch (_) {}
    if (Array.isArray(window.PAYEES)) return window.PAYEES.find((item) => item?.name === name)?.color || '#999999';
    return '#999999';
  }

  function billingPartsOf(expense) {
    const raw = Array.isArray(expense?.installments) ? expense.installments : [];
    const parts = raw.slice(0, 3)
      .map((part) => ({ date: String(part?.date || ''), amount: Number(part?.amount || 0) }))
      .filter((part) => validDate(part.date) && part.amount > 0);
    if (parts.length && parts.reduce((sum, part) => sum + part.amount, 0) === Number(expense?.amount || 0)) return parts;
    return [{ date: String(expense?.date || ''), amount: Number(expense?.amount || 0) }];
  }

  function itemRows(name) {
    return source()
      .map((expense, index) => ({
        expense,
        index,
        usageDate: usageDateOf(expense),
        dueDate: billingPartsOf(expense)[0]?.date || '',
        amount: Number(expense?.amount || 0)
      }))
      .filter(({ expense, amount }) => amount && String(expense?.payee || expense?.item || expense?.name || 'その他') === name)
      .sort((a, b) => String(b.usageDate).localeCompare(String(a.usageDate)) || b.index - a.index);
  }

  function ensureStyle() {
    if (document.getElementById('paymo-category-detail-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-category-detail-style';
    style.textContent = `
      #categorySpendRows .category-history-title{cursor:pointer;-webkit-tap-highlight-color:transparent}
      #categorySpendRows .category-history-title:active{opacity:.62}
      #paymoCategoryDetail .paymo-graph-detail-title{font-size:18px!important}
      #paymoCategoryDetail .paymo-graph-detail-month{font-size:20px!important}
      #paymoCategoryDetail .paymo-graph-detail-total{font-size:30px!important}
      #paymoCategoryDetail .paymo-graph-detail-group-name{font-size:20px!important}
      #paymoCategoryDetail .paymo-graph-detail-group-total{font-size:18px!important}
      #paymoCategoryDetail .paymo-graph-detail-columns,
      #paymoCategoryDetail .paymo-graph-detail-row{
        display:grid!important;
        grid-template-columns:64px 72px minmax(0,1fr)!important;
        align-items:center;
        column-gap:8px!important;
        width:100%;
        box-sizing:border-box;
      }
      #paymoCategoryDetail .paymo-graph-detail-columns{
        padding:8px 0 4px;
        color:var(--muted);
        font-size:11px;
        font-weight:800;
      }
      #paymoCategoryDetail .paymo-graph-detail-columns span:first-child{text-align:left}
      #paymoCategoryDetail .paymo-graph-detail-columns span:nth-child(2),
      #paymoCategoryDetail .paymo-graph-detail-due{text-align:left!important}
      #paymoCategoryDetail .paymo-graph-detail-columns span:last-child{text-align:right!important}
      #paymoCategoryDetail .paymo-graph-detail-row{cursor:pointer;-webkit-tap-highlight-color:transparent}
      #paymoCategoryDetail .paymo-graph-detail-row:active{opacity:.62}
      #paymoCategoryDetail .paymo-graph-detail-row.is-paid .paymo-graph-detail-amount{color:#22a559!important}
      #paymoCategoryDetail .paymo-graph-detail-date,
      #paymoCategoryDetail .paymo-graph-detail-due,
      #paymoCategoryDetail .paymo-graph-detail-amount{
        font-variant-numeric:tabular-nums;
        font-feature-settings:"tnum" 1;
      }
      #paymoCategoryDetail .paymo-graph-detail-date,
      #paymoCategoryDetail .paymo-graph-detail-due{
        width:auto!important;
        flex:0 0 auto!important;
        font-size:15px!important;
        white-space:nowrap;
      }
      #paymoCategoryDetail .paymo-graph-detail-date{text-align:left;color:var(--muted);font-weight:750}
      #paymoCategoryDetail .paymo-graph-detail-due{color:var(--text,#fff);font-weight:850}
      #paymoCategoryDetail .paymo-graph-detail-amount-cell{min-width:0;text-align:right!important}
      #paymoCategoryDetail .paymo-graph-detail-amount{margin-left:0!important;font-size:17px!important;text-align:right!important}
      #paymoCategoryDetail .paymo-graph-detail-paid{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function ensurePage() {
    ensureStyle();
    let page = document.getElementById('paymoCategoryDetail');
    if (page) return page;
    page = document.createElement('section');
    page.id = 'paymoCategoryDetail';
    page.className = 'paymo-graph-detail';
    page.setAttribute('data-no-page-swipe', 'true');
    page.innerHTML = `
      <div class="paymo-graph-detail-head">
        <button type="button" id="paymoCategoryDetailBack" class="paymo-graph-detail-back">‹ 戻る</button>
        <div id="paymoCategoryDetailTitle" class="paymo-graph-detail-title">履歴</div>
        <div></div>
      </div>
      <div class="paymo-graph-detail-body">
        <div class="paymo-graph-detail-summary">
          <div class="paymo-graph-detail-month">全期間</div>
          <div id="paymoCategoryDetailTotal" class="paymo-graph-detail-total"></div>
        </div>
        <div id="paymoCategoryDetailGroups" class="paymo-graph-detail-groups"></div>
      </div>`;
    document.body.appendChild(page);
    page.querySelector('#paymoCategoryDetailBack')?.addEventListener('click', closePage);
    bindBackSwipe(page);
    return page;
  }

  function renderPage(name) {
    const page = ensurePage();
    const rows = itemRows(name);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    page.querySelector('#paymoCategoryDetailTitle').textContent = name;
    page.querySelector('#paymoCategoryDetailTotal').textContent = yen(total);
    const groups = page.querySelector('#paymoCategoryDetailGroups');
    if (!rows.length) {
      groups.innerHTML = '<div class="paymo-graph-detail-empty">該当する履歴はありません。</div>';
      return page;
    }
    groups.innerHTML = `
      <section class="paymo-graph-detail-group">
        <div class="paymo-graph-detail-group-head">
          <div class="paymo-graph-detail-group-name"><i class="dot" style="background:${escapeHtml(payeeColor(name))}"></i>${escapeHtml(name)}</div>
          <div class="paymo-graph-detail-group-total">${yen(total)}</div>
        </div>
        <div class="paymo-graph-detail-columns"><span>利用日</span><span>支払期日</span><span>金額</span></div>
        <div>
          ${rows.map((row) => `
            <div class="paymo-graph-detail-row ${isPaid(row.expense) ? 'is-paid' : ''}" data-expense-id="${escapeHtml(row.expense?.id ?? '')}">
              <span class="paymo-graph-detail-date">${escapeHtml(shortDate(row.usageDate))}</span>
              <span class="paymo-graph-detail-due">${escapeHtml(shortDate(row.dueDate))}</span>
              <span class="paymo-graph-detail-amount-cell">
                <span class="paymo-graph-detail-amount">${yen(row.amount)}</span>
                ${isPaid(row.expense) ? '<span class="paymo-graph-detail-paid">支払い済</span>' : ''}
              </span>
            </div>`).join('')}
        </div>
      </section>`;
    return page;
  }

  function openPage(name) {
    activeItem = name;
    const page = renderPage(name);
    page.classList.add('is-visible');
    page.style.transition = 'none';
    page.style.transform = 'translate3d(100%,0,0)';
    document.body.classList.add('paymo-graph-detail-open');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      page.style.transition = '';
      page.classList.add('is-open');
      page.style.transform = '';
      const body = page.querySelector('.paymo-graph-detail-body');
      if (body) body.scrollTop = 0;
    }));
  }

  function closePage() {
    const page = document.getElementById('paymoCategoryDetail');
    if (!page?.classList.contains('is-visible')) return;
    page.classList.remove('is-open');
    page.style.transition = 'transform 230ms cubic-bezier(.22,.72,.24,1)';
    page.style.transform = 'translate3d(100%,0,0)';
    setTimeout(() => {
      page.classList.remove('is-visible');
      page.style.transition = '';
      page.style.transform = '';
      document.body.classList.remove('paymo-graph-detail-open');
      activeItem = null;
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

  document.addEventListener('click', (event) => {
    const title = event.target?.closest?.('#categorySpendRows .category-history-title');
    if (!title) return;
    const name = title.querySelector('span')?.textContent?.trim() || '';
    if (!name) return;
    event.preventDefault();
    event.stopPropagation();
    openPage(name);
  }, true);

  document.addEventListener('click', (event) => {
    const row = event.target?.closest?.('#paymoCategoryDetail .paymo-graph-detail-row[data-expense-id]');
    if (!row) return;
    const id = row.dataset.expenseId;
    if (!id || typeof window.paymoOpenHistoryEditor !== 'function') return;
    event.preventDefault();
    event.stopPropagation();
    closePage();
    setTimeout(() => window.paymoOpenHistoryEditor(id), 260);
  }, true);

  window.addEventListener('paymo-expenses-updated', () => {
    if (activeItem) renderPage(activeItem);
  });

  ensureStyle();
})();
