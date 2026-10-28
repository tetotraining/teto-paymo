(() => {
  const usageDateOf = (expense) => expense?.usageDate || expense?.usage_date || expense?.date || '';
  const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

  function billingPartsOf(expense) {
    const raw = Array.isArray(expense?.installments) ? expense.installments : [];
    const parts = raw.slice(0, 3).map((part) => ({ date: String(part?.date || ''), amount: Number(part?.amount || 0) })).filter((part) => /^\d{4}-\d{2}-\d{2}$/.test(part.date) && part.amount > 0);
    if (parts.length && parts.reduce((sum, part) => sum + part.amount, 0) === Number(expense?.amount || 0)) return parts;
    return [{ date: String(expense?.date || ''), amount: Number(expense?.amount || 0) }];
  }

  function usageTotalByMonth(key) {
    return expenses.filter((expense) => { const value = usageDateOf(expense); return value && ym(value) === key; }).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }

  function billingTotalByMonth(key) {
    return expenses.reduce((sum, expense) => sum + billingPartsOf(expense).filter((part) => part.date && ym(part.date) === key).reduce((s, part) => s + part.amount, 0), 0);
  }

  function billingPayeeTotal(name, key) {
    return expenses.filter((expense) => expense.payee === name).reduce((sum, expense) => sum + billingPartsOf(expense).filter((part) => part.date && ym(part.date) === key).reduce((s, part) => s + part.amount, 0), 0);
  }

  function renderUsageBars(el, offsets = [-3, -2, -1, 0]) {
    const months = offsets.map(monthKey);
    const values = months.map(usageTotalByMonth);
    const max = Math.max(...values, 1);
    el.innerHTML = months.map((month, index) => `<div class="bar-wrap"><div class="bar-value">${values[index] ? yen(values[index]) : ''}</div><div class="bar" style="height:${Math.max(3, Math.round(values[index] / max * 138))}px"></div><div class="bar-label">${monthLabel(month)}</div></div>`).join('');
  }

  function billingBreakdown(key) {
    const totals = new Map();
    expenses.forEach((expense) => {
      const name = String(expense.payee || 'その他');
      const amount = billingPartsOf(expense).filter((part) => part.date && ym(part.date) === key).reduce((sum, part) => sum + part.amount, 0);
      if (amount) totals.set(name, (totals.get(name) || 0) + amount);
    });
    const result = [], seen = new Set();
    PAYEES.forEach((payee) => { const amount = totals.get(payee.name) || 0; if (!amount) return; result.push({ name: payee.name, color: payee.color || '#999999', amount }); seen.add(payee.name); });
    totals.forEach((amount, name) => { if (!amount || seen.has(name)) return; result.push({ name, color: '#999999', amount }); });
    return result;
  }

  function ensureStackedChartStyle() {
    if (document.getElementById('paymo-stacked-home-chart-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-stacked-home-chart-style';
    style.textContent = `#homeChart .stack-bar{width:100%;min-height:3px;border-radius:8px 8px 3px 3px;overflow:hidden;display:flex;flex-direction:column-reverse;background:transparent}#homeChart .stack-bar.empty{background:#111}#homeChart .stack-segment{width:100%;min-height:0;flex:none}`;
    document.head.appendChild(style);
  }

  function renderStackedBillingBars(el, offsets) {
    ensureStackedChartStyle();
    const months = offsets.map(monthKey), totals = months.map(billingTotalByMonth), max = Math.max(...totals, 1);
    el.innerHTML = months.map((month, index) => {
      const total = totals[index], barHeight = Math.max(3, Math.round(total / max * 138));
      const segments = total ? billingBreakdown(month).map((item) => `<div class="stack-segment" style="height:${(item.amount / total * 100).toFixed(4)}%;background:${item.color}"></div>`).join('') : '';
      return `<div class="bar-wrap"><div class="bar-value">${total ? yen(total) : ''}</div><div class="stack-bar ${total ? '' : 'empty'}" style="height:${barHeight}px">${segments}</div><div class="bar-label">${monthLabel(month)}</div></div>`;
    }).join('');
  }

  function payeeColor(name) { return PAYEES.find((payee) => payee.name === name)?.color || '#999999'; }
  function localToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function shortDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '--/--'; const [, month, day] = value.split('-'); return `${Number(month)}/${Number(day)}`; }

  function upcomingBillingItems() {
    const today = localToday(), grouped = new Map();
    expenses.forEach((expense) => billingPartsOf(expense).forEach((part) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(part.date) || part.date < today) return;
      const name = String(expense.payee || 'その他'), key = `${part.date}\u0000${name}`, current = grouped.get(key) || { name, date: part.date, amount: 0 };
      current.amount += part.amount; grouped.set(key, current);
    }));
    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ja'));
  }

  function ensureUpcomingPayments() {
    let section = document.getElementById('upcomingPayments');
    if (!section) { section = document.createElement('div'); section.id = 'upcomingPayments'; section.className = 'upcoming-payments'; section.innerHTML = '<div class="upcoming-payments-title">直近の支払期日</div><div id="upcomingPaymentRows"></div>'; $('homeChart')?.insertAdjacentElement('afterend', section); }
    if (!document.getElementById('paymo-upcoming-payments-style')) { const style = document.createElement('style'); style.id = 'paymo-upcoming-payments-style'; style.textContent = `.upcoming-payments{margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}.upcoming-payments-title{font-size:13px;font-weight:800;color:var(--muted);margin-bottom:4px}.upcoming-payment-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line)}.upcoming-payment-row:first-child{border-top:0}.upcoming-payment-name{min-width:0;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.upcoming-payment-date{font-size:13px;font-weight:800;color:var(--muted);white-space:nowrap}.upcoming-payment-amount{font-size:15px;font-weight:900;white-space:nowrap;text-align:right}`; document.head.appendChild(style); }
    return section;
  }

  function renderUpcomingPayments() {
    const section = ensureUpcomingPayments(), rows = document.getElementById('upcomingPaymentRows'); if (!section || !rows) return;
    const items = upcomingBillingItems();
    if (!items.length) { rows.innerHTML = '<div class="empty">支払予定はありません。</div>'; return; }
    rows.innerHTML = items.map((item) => `<div class="upcoming-payment-row"><div class="upcoming-payment-name"><i class="dot" style="background:${payeeColor(item.name)}"></i>${escapeHtml(item.name)}</div><div class="upcoming-payment-date">${escapeHtml(shortDate(item.date))}</div><div class="upcoming-payment-amount">${yen(item.amount)}</div></div>`).join('');
  }

  function formatHistoryDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '日付なし'; const [year, month, day] = value.split('-'); return `${year}/${Number(month)}/${Number(day)}`; }
  function ensureHistoryCard() {
    const graphCard = $('graphChart')?.closest('.card'); if (!graphCard) return null;
    let card = document.getElementById('expenseHistoryCard');
    if (!card) { card = document.createElement('div'); card.id = 'expenseHistoryCard'; card.className = 'card expense-history-card'; card.innerHTML = '<div class="chart-head history-head"><h2>履歴</h2></div><div id="expenseHistoryRows"></div>'; graphCard.insertAdjacentElement('afterend', card); }
    if (!document.getElementById('paymo-expense-history-style')) { const style = document.createElement('style'); style.id = 'paymo-expense-history-style'; style.textContent = `.expense-history-card .history-head{margin-bottom:4px}.expense-history-card .history-entry{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-top:1px solid var(--line)}.expense-history-card .history-entry:first-child{border-top:0}.expense-history-card .history-left{min-width:0;display:flex;flex-direction:column;gap:5px}.expense-history-card .history-date{font-size:12px;color:var(--muted);font-weight:700}.expense-history-card .history-payee{font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.expense-history-card .history-amount{font-size:17px;font-weight:900;white-space:nowrap}`; document.head.appendChild(style); }
    return card;
  }

  function renderExpenseHistory() {
    const card = ensureHistoryCard(), rows = document.getElementById('expenseHistoryRows'); if (!card || !rows) return;
    const sorted = expenses.map((expense, index) => ({ expense, index, usageDate: usageDateOf(expense) })).sort((a, b) => String(b.usageDate).localeCompare(String(a.usageDate)) || b.index - a.index);
    if (!sorted.length) { rows.innerHTML = '<div class="empty">まだ履歴がありません。</div>'; return; }
    rows.innerHTML = sorted.map(({ expense, usageDate }) => { const name = String(expense.payee || 'その他'); return `<div class="history-entry"><div class="history-left"><div class="history-date">${escapeHtml(formatHistoryDate(usageDate))}</div><div class="history-payee"><i class="dot" style="background:${payeeColor(name)}"></i>${escapeHtml(name)}</div></div><div class="history-amount">${yen(expense.amount)}</div></div>`; }).join('');
  }

  render = function renderByUsageAndBillingDate() {
    const current = monthKey(0), billingTotal = billingTotalByMonth(current), usageTotal = usageTotalByMonth(current);
    $('homeTotal').textContent = yen(billingTotal); $('graphTotal').textContent = yen(usageTotal);
    $('payeeRows').innerHTML = PAYEES.map((payee) => `<div class="row"><span><i class="dot" style="background:${payee.color}"></i>${payee.name}</span><b>${yen(billingPayeeTotal(payee.name, current))}</b></div>`).join('');
    $('historyRows').innerHTML = [0, -1, -2, -3].map((offset) => { const key = monthKey(offset); return `<div class="row"><span>${offset === 0 ? '今月' : Math.abs(offset) + 'か月前'}</span><b>${yen(usageTotalByMonth(key))}</b></div>`; }).join('');
    const homeChartCard = $('homeChart')?.closest('.card'), homeChartTitle = homeChartCard?.querySelector('.chart-head h2'); if (homeChartTitle) homeChartTitle.textContent = '月別支払額'; const homeChartMeta = homeChartCard?.querySelector('.chart-head span'); if (homeChartMeta) homeChartMeta.textContent = '2ヶ月前〜翌々月';
    const graphChartMeta = $('graphChart')?.closest('.card')?.querySelector('.chart-head span'); if (graphChartMeta) graphChartMeta.textContent = '2ヶ月前〜翌々月';
    const fiveMonthOffsets = [-2, -1, 0, 1, 2]; renderStackedBillingBars($('homeChart'), fiveMonthOffsets); renderUpcomingPayments(); renderUsageBars($('graphChart'), fiveMonthOffsets); renderExpenseHistory();
  };
  render();
})();
