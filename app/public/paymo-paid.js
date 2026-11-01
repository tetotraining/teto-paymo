(() => {
  const isPaid = (expense) => expense?.paid === true || expense?.paid === 1 || expense?.paid === '1';
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  let activeExpenseId = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function billingPartsOf(expense) {
    const raw = Array.isArray(expense?.installments) ? expense.installments : [];
    const parts = raw.slice(0, 3)
      .map((part) => ({ date: String(part?.date || ''), amount: Number(part?.amount || 0) }))
      .filter((part) => validDate(part.date) && part.amount > 0);
    if (parts.length && parts.reduce((sum, part) => sum + part.amount, 0) === Number(expense?.amount || 0)) return parts;
    return [{ date: String(expense?.date || ''), amount: Number(expense?.amount || 0) }];
  }

  function unpaidExpenses() {
    return expenses.filter((expense) => !isPaid(expense));
  }

  function billingTotalByMonth(key) {
    return unpaidExpenses().reduce((sum, expense) => sum + billingPartsOf(expense)
      .filter((part) => part.date && ym(part.date) === key)
      .reduce((partSum, part) => partSum + part.amount, 0), 0);
  }

  function billingPayeeTotal(name, key) {
    return unpaidExpenses().filter((expense) => expense.payee === name)
      .reduce((sum, expense) => sum + billingPartsOf(expense)
        .filter((part) => part.date && ym(part.date) === key)
        .reduce((partSum, part) => partSum + part.amount, 0), 0);
  }

  function billingBreakdown(key) {
    const totals = new Map();
    unpaidExpenses().forEach((expense) => {
      const name = String(expense.payee || 'その他');
      const amount = billingPartsOf(expense)
        .filter((part) => part.date && ym(part.date) === key)
        .reduce((sum, part) => sum + part.amount, 0);
      if (amount) totals.set(name, (totals.get(name) || 0) + amount);
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

  function renderBillingBars() {
    const el = document.getElementById('homeChart');
    if (!el) return;
    const offsets = [-2, -1, 0, 1, 2];
    const months = offsets.map(monthKey);
    const totals = months.map(billingTotalByMonth);
    const max = Math.max(...totals, 1);

    el.innerHTML = months.map((month, index) => {
      const total = totals[index];
      const barHeight = total ? Math.max(3, Math.round(total / max * 138)) : 3;
      const segments = total
        ? billingBreakdown(month).map((item) => `<div class="stack-segment" style="height:${(item.amount / total * 100).toFixed(4)}%;background:${item.color}"></div>`).join('')
        : '';
      return `<div class="bar-wrap"><div class="bar-value">${total ? yen(total) : ''}</div><div class="stack-bar ${total ? '' : 'zero'}" style="height:${barHeight}px">${segments}</div><div class="bar-label">${monthLabel(month)}</div></div>`;
    }).join('');
  }

  function payeeColor(name) {
    return PAYEES.find((payee) => payee.name === name)?.color || '#999999';
  }

  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function shortDate(value) {
    if (!validDate(value)) return '--/--';
    const [, month, day] = value.split('-');
    return `${Number(month)}/${Number(day)}`;
  }

  function renderUpcomingPayments() {
    const rows = document.getElementById('upcomingPaymentRows');
    if (!rows) return;
    const today = localToday();
    const grouped = new Map();

    unpaidExpenses().forEach((expense) => billingPartsOf(expense).forEach((part) => {
      if (!validDate(part.date)) return;
      const name = String(expense.payee || 'その他');
      const key = `${part.date}\u0000${name}`;
      const current = grouped.get(key) || { name, date: part.date, amount: 0 };
      current.amount += part.amount;
      grouped.set(key, current);
    }));

    const allItems = Array.from(grouped.values());
    const overdueItems = allItems
      .filter((item) => item.date < today)
      .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 4);
    const upcomingItems = allItems
      .filter((item) => item.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ja'));

    if (!overdueItems.length && !upcomingItems.length) {
      rows.innerHTML = '<div class="empty">支払予定はありません。</div>';
      return;
    }

    const renderRow = (item, overdue = false) => `<div class="upcoming-payment-row${overdue ? ' is-overdue' : ''}"><div class="upcoming-payment-name"><i class="dot" style="background:${payeeColor(item.name)}"></i><span>${escapeHtml(item.name)}</span></div><div class="upcoming-payment-date">${escapeHtml(shortDate(item.date))}</div><div class="upcoming-payment-amount">${yen(item.amount)}</div></div>`;
    const overdueHtml = overdueItems.map((item) => renderRow(item, true)).join('');
    const dividerHtml = overdueItems.length && upcomingItems.length ? '<div class="upcoming-payment-divider" aria-hidden="true"></div>' : '';
    const upcomingHtml = upcomingItems.map((item) => renderRow(item)).join('');
    rows.innerHTML = overdueHtml + dividerHtml + upcomingHtml;
  }

  function applyBillingState() {
    const current = monthKey(0);
    const homeTotal = document.getElementById('homeTotal');
    if (homeTotal) homeTotal.textContent = yen(billingTotalByMonth(current));

    const payeeRows = document.getElementById('payeeRows');
    if (payeeRows) {
      payeeRows.innerHTML = PAYEES.map((payee) => `<div class="row"><span><i class="dot" style="background:${payee.color}"></i>${escapeHtml(payee.name)}</span><b>${yen(billingPayeeTotal(payee.name, current))}</b></div>`).join('');
    }

    renderBillingBars();
    renderUpcomingPayments();
  }

  function paintHistory() {
    document.querySelectorAll('#expenseHistoryRows .history-entry').forEach((row) => {
      const id = String(row.dataset.expenseId || '');
      const expense = expenses.find((item) => String(item.id) === id);
      const paid = Boolean(expense && isPaid(expense));
      row.classList.toggle('history-paid', paid);
      row.dataset.paid = paid ? 'true' : 'false';
    });
  }

  function ensureStyle() {
    if (document.getElementById('paymo-paid-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-paid-style';
    style.textContent = `
      #expenseHistoryRows .history-entry.history-paid .history-amount{color:#22a559!important}
      .history-edit-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      #historyEditSave{order:1}
      #historyEditDelete{order:2}
      .history-edit-paid{order:3;grid-column:1/-1;border:1px solid rgba(34,165,89,.28);border-radius:17px;padding:15px;font-size:16px;font-weight:900;background:rgba(34,165,89,.14);color:#168a45;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
      .history-edit-paid.active{background:color-mix(in srgb,#E63946 12%,var(--surface))!important;color:#E63946!important;border:0!important;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none!important}
    `;
    document.head.appendChild(style);
  }

  function refreshPaidButton() {
    const button = document.getElementById('historyEditPaid');
    if (!button) return;
    const expense = expenses.find((item) => String(item.id) === String(activeExpenseId || ''));
    const paid = Boolean(expense && isPaid(expense));
    button.classList.toggle('active', paid);
    button.setAttribute('aria-pressed', String(paid));
    button.textContent = paid ? '支払い済を取り消す' : '支払い済';
  }

  function ensurePaidButton() {
    ensureStyle();
    const actions = document.querySelector('#historyEditSheet .history-edit-actions');
    if (!actions) return false;
    const save = document.getElementById('historyEditSave');
    const remove = document.getElementById('historyEditDelete');
    if (save && actions.firstElementChild !== save) actions.insertBefore(save, actions.firstElementChild);
    if (remove && save && save.nextElementSibling !== remove) actions.insertBefore(remove, save.nextSibling);

    let button = document.getElementById('historyEditPaid');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'historyEditPaid';
      button.className = 'history-edit-paid';
      button.textContent = '支払い済';
      actions.appendChild(button);
      button.onclick = togglePaid;
    }
    refreshPaidButton();
    return true;
  }

  async function togglePaid() {
    const id = String(activeExpenseId || '');
    const index = expenses.findIndex((item) => String(item.id) === id);
    if (index < 0) return;

    const updated = { ...expenses[index], paid: !isPaid(expenses[index]) };
    expenses[index] = updated;
    localStorage.setItem(KEY, JSON.stringify(expenses));
    refreshPaidButton();

    document.getElementById('historyEditClose')?.click();
    if (typeof render === 'function') render();

    try {
      if (typeof window.paymoSyncExpenses === 'function') await window.paymoSyncExpenses([updated]);
    } catch {}
  }

  document.addEventListener('click', (event) => {
    const row = event.target?.closest?.('#expenseHistoryRows .history-entry');
    if (!row) return;
    activeExpenseId = String(row.dataset.expenseId || '');
    requestAnimationFrame(() => {
      ensurePaidButton();
      refreshPaidButton();
    });
  }, true);

  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) {
    render = function (...args) {
      const result = previousRender(...args);
      ensurePaidButton();
      applyBillingState();
      paintHistory();
      return result;
    };
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const ready = ensurePaidButton();
    applyBillingState();
    paintHistory();
    if (ready || tries >= 30) clearInterval(timer);
  }, 50);
})();
