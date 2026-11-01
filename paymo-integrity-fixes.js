(() => {
  const FIX_ID = 'paymo-integrity-fixes-v1';
  if (window[FIX_ID]) return;
  window[FIX_ID] = true;

  const usageDateOf = (expense) => String(expense?.usageDate || expense?.usage_date || expense?.date || '');
  const numberFromInput = (value) => Number(String(value || '').replace(/[^0-9]/g, ''));

  function installOverlayFix() {
    if (document.getElementById('paymo-integrity-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-integrity-overlay-style';
    style.textContent = `
      .history-delete-confirm-backdrop{z-index:950!important}
      .history-delete-confirm-sheet{z-index:951!important}
    `;
    document.head.appendChild(style);
  }

  function primeLegacyHistoryTargets(id) {
    const value = String(id || '');
    if (!value) return;
    window.paymoActiveHistoryExpenseId = value;

    const host = document.getElementById('expenseHistoryRows') || document.body;
    const probe = document.createElement('div');
    probe.className = 'history-entry';
    probe.dataset.expenseId = value;
    probe.hidden = true;
    host.appendChild(probe);
    try {
      probe.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch {}
    probe.remove();
  }

  function wrapHistoryEditor() {
    const original = window.paymoOpenHistoryEditor;
    if (typeof original !== 'function' || original.__paymoIntegrityWrapped) return false;

    const wrapped = (id) => {
      const value = String(id || '');
      if (!value) return;
      primeLegacyHistoryTargets(value);
      const result = original(value);
      window.dispatchEvent(new CustomEvent('paymo-history-editor-opened', { detail: { id: value } }));
      return result;
    };
    wrapped.__paymoIntegrityWrapped = true;
    wrapped.__paymoOriginal = original;
    window.paymoOpenHistoryEditor = wrapped;
    return true;
  }

  function bindEditorCloseCleanup() {
    const sheet = document.getElementById('historyEditSheet');
    if (!sheet || sheet.dataset.paymoIntegrityObserved === '1') return false;
    sheet.dataset.paymoIntegrityObserved = '1';
    new MutationObserver(() => {
      if (!sheet.hidden) return;
      window.paymoActiveHistoryExpenseId = '';
      window.dispatchEvent(new CustomEvent('paymo-history-editor-closed'));
    }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
    return true;
  }

  function wrapRenderUpdates() {
    if (typeof render !== 'function' || render.__paymoIntegrityWrapped) return false;
    const previous = render;
    const wrapped = function (...args) {
      const result = previous(...args);
      queueMicrotask(() => window.dispatchEvent(new CustomEvent('paymo-expenses-updated')));
      return result;
    };
    wrapped.__paymoIntegrityWrapped = true;
    wrapped.__paymoOriginal = previous;
    render = wrapped;
    return true;
  }

  function installBulkDeleteAuthBridge() {
    if (window.fetch.__paymoIntegrityWrapped) return;
    const originalFetch = window.fetch.bind(window);
    const wrappedFetch = (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input?.url || '';
      let pathname = '';
      try { pathname = new URL(rawUrl, location.href).pathname; } catch {}
      if (pathname !== '/api/expenses/bulk-delete') return originalFetch(input, init);

      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('x-paymo-key')) return originalFetch(input, init);

      headers.delete('x-paymo-key');
      const token = typeof window.paymoGetAuthToken === 'function'
        ? window.paymoGetAuthToken()
        : localStorage.getItem('paymo_token_v1') || '';
      if (token) headers.set('authorization', `Bearer ${token}`);

      return originalFetch(input, { ...(init || {}), headers });
    };
    wrappedFetch.__paymoIntegrityWrapped = true;
    wrappedFetch.__paymoOriginal = originalFetch;
    window.fetch = wrappedFetch;
  }

  function installDuplicateGuard() {
    if (document.documentElement.dataset.paymoDuplicateGuard === '1') return;
    document.documentElement.dataset.paymoDuplicateGuard = '1';

    document.addEventListener('click', (event) => {
      const save = event.target?.closest?.('#saveBtn');
      if (!save || !Array.isArray(expenses)) return;

      const amount = numberFromInput(document.getElementById('amount')?.value);
      const usageDate = document.getElementById('usageDate')?.value || (typeof today === 'function' ? today() : '');
      const payee = typeof selectedPayee === 'string' ? selectedPayee : '';
      if (!amount || !usageDate || !payee) return;

      const sameAmountAndDate = expenses.filter((expense) =>
        Number(expense?.amount || 0) === amount && usageDateOf(expense) === usageDate
      );
      if (!sameAmountAndDate.length) return;
      if (sameAmountAndDate.some((expense) => String(expense?.payee || '') === payee)) return;

      const originalExpenses = expenses;
      let proxy;
      proxy = new Proxy(originalExpenses, {
        get(target, property, receiver) {
          if (property === 'some') {
            return (callback, thisArg) => target.some((item, index) => {
              if (
                Number(item?.amount || 0) === amount &&
                usageDateOf(item) === usageDate &&
                String(item?.payee || '') !== payee
              ) return false;
              return callback.call(thisArg, item, index, proxy);
            });
          }
          return Reflect.get(target, property, receiver);
        }
      });

      expenses = proxy;
      queueMicrotask(() => {
        if (expenses === proxy) expenses = originalExpenses;
      });
    }, true);
  }

  function ensureBindings() {
    installOverlayFix();
    wrapHistoryEditor();
    bindEditorCloseCleanup();
    wrapRenderUpdates();
  }

  installBulkDeleteAuthBridge();
  installDuplicateGuard();
  ensureBindings();

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    ensureBindings();
    if (tries >= 80 || (window.paymoOpenHistoryEditor?.__paymoIntegrityWrapped && document.getElementById('historyEditSheet'))) {
      clearInterval(timer);
    }
  }, 50);

  window.paymoIntegrityStatus = () => ({
    loaded: true,
    editorTargetUnified: Boolean(window.paymoOpenHistoryEditor?.__paymoIntegrityWrapped),
    deleteOverlayRaised: Boolean(document.getElementById('paymo-integrity-overlay-style')),
    renderUpdateEvent: Boolean(typeof render === 'function' && render.__paymoIntegrityWrapped),
    bulkDeleteBearerBridge: Boolean(window.fetch.__paymoIntegrityWrapped),
    duplicateGuard: document.documentElement.dataset.paymoDuplicateGuard === '1'
  });
})();
