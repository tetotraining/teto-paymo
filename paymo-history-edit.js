(() => {
  const usageDateOf = (e) => e?.usageDate || e?.usage_date || e?.date || '';
  const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const num = (v) => Number(String(v || '').replace(/[^0-9]/g, ''));
  const escapeHtml = (v) => String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  let editingId = null;
  let selectedEditPayee = '';
  let editSplitCount = 1;

  function partsOf(expense) {
    const raw = Array.isArray(expense?.installments) ? expense.installments : [];
    const parts = raw.slice(0, 3)
      .map((p) => ({ date: String(p?.date || ''), amount: Number(p?.amount || 0) }))
      .filter((p) => validDate(p.date) && p.amount > 0);
    if (parts.length && parts.reduce((s, p) => s + p.amount, 0) === Number(expense?.amount || 0)) return parts;
    return [{ date: String(expense?.date || ''), amount: Number(expense?.amount || 0) }];
  }

  function addMonthsClamped(value, offset) {
    const base = validDate(value) ? value : today();
    const [year, month, day] = base.split('-').map(Number);
    const first = new Date(year, month - 1 + offset, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const d = Math.min(day, lastDay);
    return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function equalParts(total, count) {
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    return Array.from({ length: count }, (_, index) => base + (index === 0 ? remainder : 0));
  }

  function ensureStyle() {
    if (document.getElementById('paymo-history-edit-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-history-edit-style';
    style.textContent = `
      #expenseHistoryRows .history-entry{cursor:pointer;-webkit-tap-highlight-color:transparent}
      #expenseHistoryRows .history-entry:active{opacity:.62}
      .history-edit-backdrop{position:fixed;inset:0;background:#0008;z-index:60}
      .history-edit-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,430px);max-height:88dvh;overflow:auto;background:#f7f7f5;color:#111;border-radius:28px 28px 0 0;padding:10px 18px calc(24px + env(safe-area-inset-bottom));z-index:61;box-shadow:0 -8px 30px #0004;box-sizing:border-box;scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior:contain}
      .history-edit-sheet::-webkit-scrollbar{display:none;width:0;height:0}
      .history-edit-head{display:flex;justify-content:space-between;align-items:center}
      .history-edit-head h2{font-size:24px;margin:4px 0 18px}
      .history-edit-field{margin-bottom:17px;min-width:0}
      .history-edit-field>span{display:block;font-size:13px;font-weight:800;margin-bottom:7px}
      .history-edit-input{-webkit-appearance:none;appearance:none;display:block;inline-size:100%;width:100%;min-inline-size:0;min-width:0;max-inline-size:100%;max-width:100%;height:48px;border:1px solid #d7d7d4;background:#fff;border-radius:15px;padding:0 12px;box-sizing:border-box;font-weight:800;text-align:center;overflow:hidden}
      .history-edit-input[type="date"]::-webkit-date-and-time-value{display:flex;align-items:center;justify-content:center;width:100%;height:100%;margin:0;padding:0;text-align:center}
      .history-edit-input[type="date"]::-webkit-datetime-edit{display:flex;align-items:center;justify-content:center;width:100%;height:100%;margin:0;padding:0}
      .history-edit-split-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .history-edit-split-button{border:1px solid #d7d7d4;background:#fff;color:#111;border-radius:14px;padding:11px 6px;font-weight:800;min-width:0}
      .history-edit-split-button.selected{background:#111;color:#fff;border-color:#111}
      .history-edit-payees{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0}
      .history-edit-payee{min-width:0;border:1px solid #d7d7d4;background:#fff;padding:12px;border-radius:15px;font-weight:800;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .history-edit-payee.selected{background:#111;color:#fff;border-color:#111}
      .history-edit-parts{display:grid;gap:12px;min-width:0}
      .history-edit-part{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;min-width:0;width:100%}
      .history-edit-part label{display:block;min-width:0;max-width:100%;overflow:hidden}
      .history-edit-part label>span{display:block;font-size:11px;font-weight:800;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .history-edit-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:20px}
      .history-edit-save,.history-edit-delete{border:0;border-radius:17px;padding:15px;font-size:16px;font-weight:900}
      .history-edit-save{background:#000;color:#fff}.history-edit-delete{background:#e9e9e6;color:#d93025}
      .history-edit-error{display:none;color:#d93025;font-size:12px;font-weight:800;margin:8px 0}.history-edit-error.show{display:block}
      .history-edit-sheet .amount{min-width:0;box-sizing:border-box}
      .history-edit-sheet .amount input{min-width:0;max-width:100%;box-sizing:border-box}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    if (document.getElementById('historyEditSheet')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'historyEditBackdrop';
    backdrop.className = 'history-edit-backdrop';
    backdrop.hidden = true;

    const sheet = document.createElement('section');
    sheet.id = 'historyEditSheet';
    sheet.className = 'history-edit-sheet';
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="grab"></div>
      <div class="history-edit-head"><h2>履歴を編集</h2><button id="historyEditClose" class="close">×</button></div>
      <div class="history-edit-field"><span>金額</span><div class="amount"><b>¥</b><input id="historyEditAmount" inputmode="numeric"></div></div>
      <div class="history-edit-field"><span>分割回数</span><div id="historyEditSplitButtons" class="history-edit-split-buttons"></div></div>
      <div class="history-edit-field"><span>ご利用日</span><input id="historyEditUsageDate" class="history-edit-input" type="date"></div>
      <div id="historyEditParts" class="history-edit-field"></div>
      <div class="history-edit-field"><span>支払先</span><div id="historyEditPayees" class="history-edit-payees"></div></div>
      <div id="historyEditError" class="history-edit-error"></div>
      <div class="history-edit-actions"><button id="historyEditDelete" class="history-edit-delete">削除</button><button id="historyEditSave" class="history-edit-save">保存</button></div>`;

    document.body.append(backdrop, sheet);
    backdrop.onclick = closeEditor;
    sheet.querySelector('#historyEditClose').onclick = closeEditor;
    sheet.querySelector('#historyEditSave').onclick = saveEdit;
    sheet.querySelector('#historyEditDelete').onclick = deleteEdit;
    sheet.querySelector('#historyEditAmount').addEventListener('input', refreshSplitAmounts);
  }

  function renderSplitButtons() {
    const el = document.getElementById('historyEditSplitButtons');
    if (!el) return;
    el.innerHTML = [
      { count: 1, label: '一括' },
      { count: 2, label: '2分割' },
      { count: 3, label: '3分割' }
    ].map((item) => `<button type="button" class="history-edit-split-button ${item.count === editSplitCount ? 'selected' : ''}" data-count="${item.count}">${item.label}</button>`).join('');
    el.querySelectorAll('.history-edit-split-button').forEach((button) => {
      button.onclick = () => setEditSplitCount(Number(button.dataset.count || 1));
    });
  }

  function renderPayees() {
    const el = document.getElementById('historyEditPayees');
    if (!el) return;
    el.innerHTML = PAYEES.map((p, index) => `
      <button type="button" class="history-edit-payee ${p.name === selectedEditPayee ? 'selected' : ''}" data-index="${index}">
        <i class="dot" style="background:${p.color}"></i>${escapeHtml(p.name)}
      </button>`).join('');
    el.querySelectorAll('.history-edit-payee').forEach((button) => {
      button.onclick = () => {
        const payee = PAYEES[Number(button.dataset.index)];
        if (!payee) return;
        selectedEditPayee = payee.name;
        renderPayees();
      };
    });
  }

  function currentRenderedParts() {
    const parts = [];
    for (let i = 0; i < editSplitCount; i += 1) {
      const date = document.getElementById(`historyEditDate${i}`)?.value || '';
      const amount = editSplitCount === 1
        ? num(document.getElementById('historyEditAmount')?.value)
        : num(document.getElementById(`historyEditPartAmount${i}`)?.value);
      if (date || amount) parts.push({ date, amount });
    }
    return parts;
  }

  function makeParts(expense, draft = []) {
    const total = num(document.getElementById('historyEditAmount')?.value) || Number(expense?.amount || 0);
    const original = partsOf(expense);
    const source = draft.length ? draft : original;
    const sameCount = source.length === editSplitCount;
    const baseDate = validDate(source[0]?.date) ? source[0].date : (validDate(expense?.date) ? expense.date : today());
    const amounts = equalParts(total, editSplitCount);

    return Array.from({ length: editSplitCount }, (_, index) => ({
      date: validDate(source[index]?.date) ? source[index].date : addMonthsClamped(baseDate, index),
      amount: sameCount && Number(source[index]?.amount || 0) > 0 ? Number(source[index].amount) : amounts[index]
    }));
  }

  function renderParts(expense, draft = []) {
    const parts = makeParts(expense, draft);
    const el = document.getElementById('historyEditParts');
    if (!el) return;

    el.innerHTML = `
      <span>${editSplitCount > 1 ? '請求日 / 各回の支払額' : '請求日'}</span>
      <div class="history-edit-parts">
        ${parts.map((p, i) => `
          <div class="history-edit-part">
            <label>
              <span>${editSplitCount > 1 ? `${i + 1}回目の請求日` : '請求日'}</span>
              <input id="historyEditDate${i}" class="history-edit-input" type="date" value="${p.date}">
            </label>
            <label class="history-edit-part-amount">
              <span>${editSplitCount > 1 ? `${i + 1}回目の支払額` : '支払額'}</span>
              <input id="historyEditPartAmount${i}" class="history-edit-input" inputmode="numeric" value="${p.amount}">
            </label>
          </div>`).join('')}
      </div>`;

    if (editSplitCount === 1) {
      const row = el.querySelector('.history-edit-part');
      const amountLabel = el.querySelector('.history-edit-part-amount');
      if (row) row.style.gridTemplateColumns = 'minmax(0,1fr)';
      if (amountLabel) amountLabel.style.display = 'none';
    }
  }

  function setEditSplitCount(count) {
    const expense = expenses.find((e) => e.id === editingId);
    if (!expense) return;
    const draft = currentRenderedParts();
    editSplitCount = count === 2 || count === 3 ? count : 1;
    renderSplitButtons();
    renderParts(expense, draft);
  }

  function refreshSplitAmounts() {
    if (editSplitCount === 1) return;
    const total = num(document.getElementById('historyEditAmount')?.value);
    const amounts = equalParts(total, editSplitCount);
    amounts.forEach((amount, index) => {
      const input = document.getElementById(`historyEditPartAmount${index}`);
      if (input) input.value = amount || '';
    });
  }

  function openEditor(id) {
    const expense = expenses.find((e) => e.id === id);
    if (!expense) return;
    editingId = id;
    selectedEditPayee = String(expense.payee || '');
    editSplitCount = Math.min(3, Math.max(1, partsOf(expense).length));
    ensureUi();
    document.getElementById('historyEditAmount').value = Number(expense.amount || 0) || '';
    document.getElementById('historyEditUsageDate').value = usageDateOf(expense);
    renderSplitButtons();
    renderParts(expense);
    renderPayees();
    document.getElementById('historyEditError').classList.remove('show');
    document.getElementById('historyEditBackdrop').hidden = false;
    document.getElementById('historyEditSheet').hidden = false;
  }

  function closeEditor() {
    editingId = null;
    editSplitCount = 1;
    const backdrop = document.getElementById('historyEditBackdrop');
    const sheet = document.getElementById('historyEditSheet');
    if (backdrop) backdrop.hidden = true;
    if (sheet) sheet.hidden = true;
  }

  function showError(text) {
    const el = document.getElementById('historyEditError');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('show', Boolean(text));
  }

  async function saveEdit() {
    const index = expenses.findIndex((e) => e.id === editingId);
    if (index < 0) return;

    const original = expenses[index];
    const total = num(document.getElementById('historyEditAmount').value);
    const usageDate = document.getElementById('historyEditUsageDate').value;
    if (!total || !validDate(usageDate) || !selectedEditPayee) {
      showError('支払先・ご利用日・金額を確認してください。');
      return;
    }

    const parts = [];
    for (let i = 0; i < editSplitCount; i += 1) {
      const date = document.getElementById(`historyEditDate${i}`)?.value || '';
      const amount = editSplitCount === 1 ? total : num(document.getElementById(`historyEditPartAmount${i}`)?.value);
      if (!validDate(date) || !amount) {
        showError('請求日と支払額を確認してください。');
        return;
      }
      parts.push({ date, amount });
    }

    if (parts.reduce((sum, part) => sum + part.amount, 0) !== total) {
      showError('各回の支払額の合計を金額と同じにしてください。');
      return;
    }

    const updated = {
      ...original,
      payee: selectedEditPayee,
      usageDate,
      usage_date: undefined,
      amount: total,
      date: parts[0].date,
      splitCount: editSplitCount,
      installments: parts
    };

    expenses[index] = updated;
    localStorage.setItem(KEY, JSON.stringify(expenses));
    closeEditor();
    render();
    showToast();
    try {
      if (typeof window.paymoSyncExpenses === 'function') await window.paymoSyncExpenses([updated]);
    } catch {}
  }

  async function deleteEdit() {
    const id = editingId;
    if (!id) return;
    if (!confirm('この履歴を削除しますか？')) return;

    expenses = expenses.filter((e) => e.id !== id);
    localStorage.setItem(KEY, JSON.stringify(expenses));
    closeEditor();
    render();

    try {
      if (typeof window.paymoDeleteExpense === 'function') await window.paymoDeleteExpense(id);
    } catch {}
  }

  function bindRows() {
    ensureStyle();
    ensureUi();
    const rows = Array.from(document.querySelectorAll('#expenseHistoryRows .history-entry'));
    const oldestMonth = monthKey(-2);
    const sorted = expenses
      .map((expense, index) => ({ expense, index, usageDate: usageDateOf(expense) }))
      .filter((item) => item.usageDate && String(ym(item.usageDate) || '') >= oldestMonth)
      .sort((a, b) => String(b.usageDate).localeCompare(String(a.usageDate)) || b.index - a.index);

    rows.forEach((row, index) => {
      const id = sorted[index]?.expense?.id;
      if (!id) return;
      row.dataset.expenseId = id;
      row.onclick = () => openEditor(id);
    });
  }

  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) {
    render = function (...args) {
      const result = previousRender(...args);
      bindRows();
      return result;
    };
  }

  bindRows();
})();