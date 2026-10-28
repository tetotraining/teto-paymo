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

  function renderBarsBy(el, dateGetter) {
    const months = [-3, -2, -1, 0].map(monthKey);
    const values = months.map((month) => totalByMonth(month, dateGetter));
    const max = Math.max(...values, 1);
    el.innerHTML = months.map((month, index) =>
      `<div class="bar-wrap"><div class="bar-value">${values[index] ? yen(values[index]) : ''}</div><div class="bar" style="height:${Math.max(3, Math.round(values[index] / max * 138))}px"></div><div class="bar-label">${monthLabel(month)}</div></div>`
    ).join('');
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

    renderBarsBy($('homeChart'), billingDateOf);
    renderBarsBy($('graphChart'), usageDateOf);
  };

  render();
})();
