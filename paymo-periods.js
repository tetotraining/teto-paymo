(() => {
  const usageDateOf = (expense) => expense?.usageDate || expense?.usage_date || expense?.date || '';
  const billingDateOf = (expense) => expense?.date || '';

  function totalByMonth(key, dateGetter) {
    return expenses
      .filter((expense) => {
        const value = dateGetter(expense);
        return value && ym(value) === key;
      })
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }

  function billingPayeeTotal(name, key) {
    return expenses
      .filter((expense) => expense.payee === name && billingDateOf(expense) && ym(billingDateOf(expense)) === key)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }

  function renderBarsBy(el, dateGetter, offsets = [-3, -2, -1, 0]) {
    const months = offsets.map(monthKey);
    const values = months.map((month) => totalByMonth(month, dateGetter));
    const max = Math.max(...values, 1);
    el.innerHTML = months.map((month, index) =>
      `<div class="bar-wrap"><div class="bar-value">${values[index] ? yen(values[index]) : ''}</div><div class="bar" style="height:${Math.max(3, Math.round(values[index] / max * 138))}px"></div><div class="bar-label">${monthLabel(month)}</div></div>`
    ).join('');
  }

  function billingBreakdown(key) {
    const totals = new Map();
    expenses.forEach((expense) => {
      const date = billingDateOf(expense);
      if (!date || ym(date) !== key) return;
      const name = String(expense.payee || 'その他');
      totals.set(name, (totals.get(name) || 0) + Number(expense.amount || 0));
    });

    const result = [];
    const seen = new Set();
    PAYEES.forEach((payee) => {
      const amount = totals.get(payee.name) || 0;
      if (!amount) return;
      result.push({ name: payee.name, color: payee.color || '#999999', amount });
      seen.add(payee.name);
    });
    totals.forEach((amount, name) => {
      if (!amount || seen.has(name)) return;
      result.push({ name, color: '#999999', amount });
    });
    return result;
  }

  function ensureStackedChartStyle() {
    if (document.getElementById('paymo-stacked-home-chart-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-stacked-home-chart-style';
    style.textContent = `
      #homeChart .stack-bar{
        width:100%;
        min-height:3px;
        border-radius:8px 8px 3px 3px;
        overflow:hidden;
        display:flex;
        flex-direction:column-reverse;
        background:transparent;
      }
      #homeChart .stack-bar.empty{background:#111;}
      #homeChart .stack-segment{width:100%;min-height:0;flex:none;}
    `;
    document.head.appendChild(style);
  }

  function renderStackedBillingBars(el, offsets) {
    ensureStackedChartStyle();
    const months = offsets.map(monthKey);
    const totals = months.map((month) => totalByMonth(month, billingDateOf));
    const max = Math.max(...totals, 1);

    el.innerHTML = months.map((month, index) => {
      const total = totals[index];
      const barHeight = Math.max(3, Math.round(total / max * 138));
      const segments = total
        ? billingBreakdown(month).map((item) =>
            `<div class="stack-segment" style="height:${(item.amount / total * 100).toFixed(4)}%;background:${item.color}"></div>`
          ).join('')
        : '';
      return `<div class="bar-wrap"><div class="bar-value">${total ? yen(total) : ''}</div><div class="stack-bar ${total ? '' : 'empty'}" style="height:${barHeight}px">${segments}</div><div class="bar-label">${monthLabel(month)}</div></div>`;
    }).join('');
  }

  render = function renderByUsageAndBillingDate() {
    const current = monthKey(0);
    const billingTotal = totalByMonth(current, billingDateOf);
    const usageTotal = totalByMonth(current, usageDateOf);

    $('homeTotal').textContent = yen(billingTotal);
    $('graphTotal').textContent = yen(usageTotal);

    $('payeeRows').innerHTML = PAYEES.map((payee) =>
      `<div class="row"><span><i class="dot" style="background:${payee.color}"></i>${payee.name}</span><b>${yen(billingPayeeTotal(payee.name, current))}</b></div>`
    ).join('');

    $('historyRows').innerHTML = [0, -1, -2, -3].map((offset) => {
      const key = monthKey(offset);
      return `<div class="row"><span>${offset === 0 ? '今月' : Math.abs(offset) + 'か月前'}</span><b>${yen(totalByMonth(key, usageDateOf))}</b></div>`;
    }).join('');

    const homeChartCard = $('homeChart')?.closest('.card');
    const homeChartTitle = homeChartCard?.querySelector('.chart-head h2');
    if (homeChartTitle) homeChartTitle.textContent = '月別支払額';
    const homeChartMeta = homeChartCard?.querySelector('.chart-head span');
    if (homeChartMeta) homeChartMeta.textContent = '2ヶ月前〜翌々月';

    const graphChartMeta = $('graphChart')?.closest('.card')?.querySelector('.chart-head span');
    if (graphChartMeta) graphChartMeta.textContent = '2ヶ月前〜翌々月';

    const fiveMonthOffsets = [-2, -1, 0, 1, 2];
    renderStackedBillingBars($('homeChart'), fiveMonthOffsets);
    renderBarsBy($('graphChart'), usageDateOf, fiveMonthOffsets);
  };

  render();
})();
