(() => {
  const usageDateOf = (e) => e?.usageDate || e?.usage_date || e?.date || '';
  const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const num = (v) => Number(String(v || '').replace(/[^0-9]/g, ''));
  let editingId = null;
  let selectedEditPayee = '';

  function partsOf(expense) {
    const raw = Array.isArray(expense?.installments) ? expense.installments : [];
    const parts = raw.slice(0, 3).map((p) => ({ date: String(p?.date || ''), amount: Number(p?.amount || 0) }))
      .filter((p) => validDate(p.date) && p.amount > 0);
    if (parts.length && parts.reduce((s, p) => s + p.amount, 0) === Number(expense?.amount || 0)) return parts;
    return [{ date: String(expense?.date || ''), amount: Number(expense?.amount || 0) }];
  }

  function ensureStyle() {
    if (document.getElementById('paymo-history-edit-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-history-edit-style';
    style.textContent = `
      #expenseHistoryRows .history-entry{cursor:pointer;-webkit-tap-highlight-color:transparent}
      #expenseHistoryRows .history-entry:active{opacity:.62}
      .history-edit-backdrop{position:fixed;inset:0;background:#0008;z-index:60}
      .history-edit-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,430px);max-height:88dvh;overflow:auto;background:#f7f7f5;color:#111;border-radius:28px 28px 0 0;padding:10px 18px calc(24px + env(safe-area-inset-bottom));z-index:61;box-shadow:0 -8px 30px #0004}
      .history-edit-head{display:flex;justify-content:space-between;align-items:center}.history-edit-head h2{font-size:24px;margin:4px 0 18px}
      .history-edit-field{margin-bottom:17px}.history-edit-field>span{display:block;font-size:13px;font-weight:800;margin-bottom:7px}
      .history-edit-input{width:100%;height:48px;border:1px solid #d7d7d4;background:#fff;border-radius:15px;padding:0 13px;box-sizing:border-box;font-weight:800;text-align:center}
      .history-edit-payees{display:grid;grid-template-columns:1fr 1fr;gap:8px}.history-edit-payee{border:1px solid #d7d7d4;background:#fff;padding:12px;border-radius:15px;font-weight:800;text-align:left}.history-edit-payee.selected{background:#111;color:#fff;border-color:#111}
      .history-edit-parts{display:grid;gap:10px}.history-edit-part{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.75fr);gap:8px}.history-edit-part label{min-width:0}.history-edit-part label>span{display:block;font-size:11px;font-weight:800;margin-bottom:5px}
      .history-edit-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}.history-edit-save,.history-edit-delete{border:0;border-radius:17px;padding:15px;font-size:16px;font-weight:900}.history-edit-save{background:#000;color:#fff}.history-edit-delete{background:#e9e9e6;color:#d93025}
      .history-edit-error{display:none;color:#d93025;font-size:12px;font-weight:800;margin:8px 0}.history-edit-error.show{display:block}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    if (document.getElementById('historyEditSheet')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'historyEditBackdrop'; backdrop.className = 'history-edit-backdrop'; backdrop.hidden = true;
    const sheet = document.createElement('section');
    sheet.id = 'historyEditSheet'; sheet.className = 'history-edit-sheet'; sheet.hidden = true;
    sheet.innerHTML = `
      <div class="grab"></div>
      <div class="history-edit-head"><h2>履歴を編集</h2><button id="historyEditClose" class="close">×</button></div>
      <div class="history-edit-field"><span>項目</span><div id="historyEditPayees" class="history-edit-payees"></div></div>
      <div class="history-edit-field"><span>ご利用日</span><input id="historyEditUsageDate" class="history-edit-input" type="date"></div>
      <div class="history-edit-field"><span>金額</span><div class="amount"><b>¥</b><input id="historyEditAmount" inputmode="numeric"></div></div>
      <div id="historyEditParts" class="history-edit-field"></div>
      <div id="historyEditError" class="history-edit-error"></div>
      <div class="history-edit-actions"><button id="historyEditDelete" class="history-edit-delete">削除</button><button id="historyEditSave" class="history-edit-save">保存</button></div>`;
    document.body.append(backdrop, sheet);
    backdrop.onclick = closeEditor;
    sheet.querySelector('#historyEditClose').onclick = closeEditor;
    sheet.querySelector('#historyEditSave').onclick = saveEdit;
    sheet.querySelector('#historyEditDelete').onclick = deleteEdit;
  }

  function renderPayees() {
    const el = document.getElementById('historyEditPayees'); if (!el) return;
    el.innerHTML = PAYEES.map((p) => `<button type="button" class="history-edit-payee ${p.name === selectedEditPayee ? 'selected' : ''}" data-name="${String(p.name).replaceAll('&','&amp;').replaceAll('"','&quot;')}"><i class="dot" style="background:${p.color}"></i>${p.name}</button>`).join('');
    el.querySelectorAll('.history-edit-payee').forEach((b) => b.onclick = () => { selectedEditPayee = b.dataset.name; renderPayees(); });
  }

  function renderParts(expense) {
    const parts = partsOf(expense), el = document.getElementById('historyEditParts'); if (!el) return;
    el.innerHTML = `<span>${parts.length > 1 ? '請求日 / 各回の支払額' : '請求日'}</span><div class="history-edit-parts">${parts.map((p, i) => `
      <div class="history-edit-part">
        <label><span>${parts.length > 1 ? `${i + 1}回目の請求日` : '請求日'}</span><input id="historyEditDate${i}" class="history-edit-input" type="date" value="${p.date}"></label>
        <label><span>${parts.length > 1 ? `${i + 1}回目の支払額` : '支払額'}</span><input id="historyEditPartAmount${i}" class="history-edit-input" inputmode="numeric" value="${p.amount}"></label>
      </div>`).join('')}</div>`;
    if (parts.length === 1) el.querySelector('.history-edit-part label:last-child').style.display = 'none';
  }

  function openEditor(id) {
    const expense = expenses.find((e) => e.id === id); if (!expense) return;
    editingId = id; selectedEditPayee = String(expense.payee || '');
    ensureUi(); renderPayees(); renderParts(expense);
    document.getElementById('historyEditUsageDate').value = usageDateOf(expense);
    document.getElementById('historyEditAmount').value = Number(expense.amount || 0) || '';
    document.getElementById('historyEditError').classList.remove('show');
    document.getElementById('historyEditBackdrop').hidden = false;
    document.getElementById('historyEditSheet').hidden = false;
  }

  function closeEditor() {
    editingId = null;
    const b = document.getElementById('historyEditBackdrop'), s = document.getElementById('historyEditSheet');
    if (b) b.hidden = true; if (s) s.hidden = true;
  }

  function showError(text) { const e = document.getElementById('historyEditError'); if (!e) return; e.textContent = text; e.classList.toggle('show', Boolean(text)); }

  async function saveEdit() {
    const index = expenses.findIndex((e) => e.id === editingId); if (index < 0) return;
    const original = expenses[index], total = num(document.getElementById('historyEditAmount').value), usageDate = document.getElementById('historyEditUsageDate').value;
    if (!total || !validDate(usageDate) || !selectedEditPayee) return showError('項目・ご利用日・金額を確認してください。');
    const oldParts = partsOf(original), parts = [];
    for (let i = 0; i < oldParts.length; i++) {
      const date = document.getElementById(`historyEditDate${i}`)?.value || '';
      const amount = oldParts.length === 1 ? total : num(document.getElementById(`historyEditPartAmount${i}`)?.value);
      if (!validDate(date) || !amount) return showError('請求日と支払額を確認してください。');
      parts.push({ date, amount });
    }
    if (parts.reduce((s,p)=>s+p.amount,0) !== total) return showError('各回の支払額の合計を金額と同じにしてください。');
    const updated = { ...original, payee:selectedEditPayee, usageDate, usage_date:undefined, amount:total, date:parts[0].date, splitCount:parts.length, installments:parts };
    expenses[index] = updated;
    localStorage.setItem(KEY, JSON.stringify(expenses));
    closeEditor(); render(); showToast();
    try { if (typeof window.paymoSyncExpenses === 'function') await window.paymoSyncExpenses([updated]); } catch {}
  }

  async function deleteEdit() {
    const id = editingId; if (!id) return;
    if (!confirm('この履歴を削除しますか？')) return;
    try { if (typeof window.paymoDeleteExpense === 'function') await window.paymoDeleteExpense(id); } catch { return showError('削除できませんでした。通信状態を確認してください。'); }
    expenses = expenses.filter((e) => e.id !== id);
    localStorage.setItem(KEY, JSON.stringify(expenses));
    closeEditor(); render();
  }

  function bindRows() {
    ensureStyle(); ensureUi();
    const rows = Array.from(document.querySelectorAll('#expenseHistoryRows .history-entry'));
    const sorted = expenses.map((expense,index)=>({expense,index,usageDate:usageDateOf(expense)})).sort((a,b)=>String(b.usageDate).localeCompare(String(a.usageDate)) || b.index-a.index);
    rows.forEach((row,i) => { const id = sorted[i]?.expense?.id; if (!id) return; row.dataset.expenseId = id; row.onclick = () => openEditor(id); });
  }

  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) render = function(...args){ const result = previousRender(...args); bindRows(); return result; };
  bindRows();
})();
