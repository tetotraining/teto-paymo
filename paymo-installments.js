(() => {
  let splitCount = 1;

  const numberFromInput = (value) => Number(String(value || '').replace(/[^0-9]/g, ''));
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');

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
    if (document.getElementById('paymo-installments-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-installments-style';
    style.textContent = `
      .split-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
      .split-button{border:1px solid #d7d7d4;background:#fff;color:#111;border-radius:14px;padding:11px 6px;font-weight:800;}
      .split-button.selected{background:#111;color:#fff;border-color:#111;}
      .installment-details{margin-bottom:17px;}
      .installment-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .installment-grid.three{grid-template-columns:1fr 1fr 1fr;}
      .installment-subfield{min-width:0;}
      .installment-subfield>span{display:block;font-size:12px;font-weight:800;margin-bottom:7px;white-space:nowrap;}
      .installment-date{width:100%!important;min-width:0!important;height:48px!important;padding:0 8px!important;border:1px solid #d7d7d4!important;border-radius:15px!important;background:#fff!important;box-sizing:border-box!important;text-align:center!important;}
      .installment-amount{padding:8px 10px!important;border-radius:15px!important;}
      .installment-amount b{font-size:18px!important;}
      .installment-amount input{width:100%!important;min-width:0!important;font-size:23px!important;}
      .installment-error{display:none;margin-top:9px;font-size:12px;font-weight:800;color:#d93025;}
      .installment-error.show{display:block;}
      .installment-date::-webkit-date-and-time-value{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;text-align:center!important;}
      .installment-date::-webkit-datetime-edit{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    const amountField = $('amount')?.closest('.field');
    const billingField = $('date')?.closest('.field');
    if (!amountField || !billingField) return;

    let splitField = document.getElementById('splitCountField');
    if (!splitField) {
      splitField = document.createElement('div');
      splitField.id = 'splitCountField';
      splitField.className = 'field';
      splitField.innerHTML = `
        <span>分割回数</span>
        <div class="split-buttons">
          <button type="button" class="split-button selected" data-split="1">一括</button>
          <button type="button" class="split-button" data-split="2">2分割</button>
          <button type="button" class="split-button" data-split="3">3分割</button>
        </div>`;
      amountField.insertAdjacentElement('afterend', splitField);
      splitField.querySelectorAll('.split-button').forEach((button) => {
        button.addEventListener('click', () => setSplitCount(Number(button.dataset.split || 1)));
      });
    }

    let details = document.getElementById('installmentDetails');
    if (!details) {
      details = document.createElement('div');
      details.id = 'installmentDetails';
      details.className = 'installment-details';
      details.hidden = true;
      billingField.insertAdjacentElement('afterend', details);
    }

    ensureStyle();
  }

  function setSelectedButton() {
    document.querySelectorAll('.split-button').forEach((button) => {
      button.classList.toggle('selected', Number(button.dataset.split) === splitCount);
    });
  }

  function renderDetails() {
    const billingField = $('date')?.closest('.field');
    const details = document.getElementById('installmentDetails');
    if (!billingField || !details) return;

    setSelectedButton();
    if (splitCount === 1) {
      billingField.hidden = false;
      details.hidden = true;
      details.innerHTML = '';
      return;
    }

    billingField.hidden = true;
    details.hidden = false;
    const baseDate = $('date').value || today();
    const total = numberFromInput($('amount').value);
    const parts = equalParts(total, splitCount);
    const gridClass = splitCount === 3 ? 'installment-grid three' : 'installment-grid';

    const dateFields = Array.from({ length: splitCount }, (_, index) => `
      <div class="installment-subfield">
        <span>${index + 1}回目の請求日</span>
        <input id="installmentDate${index + 1}" class="date-input installment-date" type="date" value="${addMonthsClamped(baseDate, index)}" />
      </div>`).join('');

    const amountFields = Array.from({ length: splitCount }, (_, index) => `
      <div class="installment-subfield">
        <span>${index + 1}回目の支払額</span>
        <div class="amount installment-amount"><b>¥</b><input id="installmentAmount${index + 1}" inputmode="numeric" value="${parts[index] || ''}" /></div>
      </div>`).join('');

    details.innerHTML = `
      <div class="field"><div class="${gridClass}">${dateFields}</div></div>
      <div class="field"><div class="${gridClass}">${amountFields}</div></div>
      <div id="installmentError" class="installment-error"></div>`;
  }

  function setSplitCount(count) {
    splitCount = count === 2 || count === 3 ? count : 1;
    renderDetails();
  }

  function refreshAutoAmounts() {
    if (splitCount === 1) return;
    const total = numberFromInput($('amount').value);
    const parts = equalParts(total, splitCount);
    parts.forEach((part, index) => {
      const input = document.getElementById(`installmentAmount${index + 1}`);
      if (input) input.value = part || '';
    });
  }

  function showError(message) {
    const error = document.getElementById('installmentError');
    if (!error) return;
    error.textContent = message;
    error.classList.toggle('show', Boolean(message));
  }

  function collectInstallments(total) {
    if (splitCount === 1) {
      return [{ date: $('date').value || today(), amount: total }];
    }

    const parts = [];
    for (let index = 0; index < splitCount; index += 1) {
      const date = document.getElementById(`installmentDate${index + 1}`)?.value || '';
      const amount = numberFromInput(document.getElementById(`installmentAmount${index + 1}`)?.value);
      if (!validDate(date) || !amount) return null;
      parts.push({ date, amount });
    }
    if (parts.reduce((sum, part) => sum + part.amount, 0) !== total) return false;
    return parts;
  }

  function resetUi() {
    splitCount = 1;
    setSelectedButton();
    const billingField = $('date')?.closest('.field');
    if (billingField) billingField.hidden = false;
    const details = document.getElementById('installmentDetails');
    if (details) {
      details.hidden = true;
      details.innerHTML = '';
    }
  }

  function bindSave() {
    const saveButton = $('saveBtn');
    if (!saveButton) return;
    saveButton.onclick = async () => {
      const amount = numberFromInput($('amount').value);
      if (!amount) {
        $('amount').focus();
        return;
      }

      const installments = collectInstallments(amount);
      if (installments === null) {
        showError('請求日と各回の支払額を入力してください。');
        return;
      }
      if (installments === false) {
        showError('各回の支払額の合計を、上の金額と同じにしてください。');
        return;
      }
      showError('');

      const expense = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        amount,
        payee: selectedPayee,
        usageDate: $('usageDate')?.value || today(),
        date: installments[0].date,
        splitCount,
        installments
      };

      expenses.push(expense);
      localStorage.setItem(KEY, JSON.stringify(expenses));
      closeSheet();
      resetUi();
      render();
      showToast();

      try {
        if (typeof window.paymoSyncExpenses === 'function') await window.paymoSyncExpenses([expense]);
      } catch {
        // オフライン時も端末保存を残し、次回同期する。
      }
    };
  }

  function init() {
    ensureUi();
    $('amount')?.addEventListener('input', refreshAutoAmounts);
    $('addBtn')?.addEventListener('click', () => requestAnimationFrame(resetUi));
    bindSave();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
