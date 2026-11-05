(() => {
  const ENDPOINT = '/api/spending-threshold-settings';
  let loading = false;
  let saving = false;
  let saveQueued = false;
  const token = () => typeof window.paymoGetAuthToken === 'function'
    ? window.paymoGetAuthToken()
    : localStorage.getItem('paymo_token_v1') || '';

  function status(message = '') {
    const el = document.getElementById('paymoSpendingThresholdStatus');
    if (el) el.textContent = message;
  }

  function amountOf(value) {
    const digits = String(value || '').replace(/[^0-9]/g, '');
    if (!digits) return 0;
    const amount = Number(digits);
    return Number.isSafeInteger(amount) ? amount : 0;
  }

  function formatAmount(value) {
    const amount = amountOf(value);
    return amount ? amount.toLocaleString('ja-JP') : '';
  }

  async function api(body) {
    const authorization = token();
    const response = await fetch(ENDPOINT, {
      method: body ? 'POST' : 'GET',
      headers: {
        'content-type': 'application/json',
        ...(authorization ? { authorization: 'Bearer ' + authorization } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload.error || '通知設定を読み込めませんでした');
    return payload;
  }

  function syncState() {
    const enabled = document.getElementById('paymoSpendingThresholdEnabled');
    const amount = document.getElementById('paymoSpendingThresholdAmount');
    if (amount && enabled) amount.setAttribute('aria-label', '通知する支出額（円）');
  }

  function ensureControls() {
    if (document.getElementById('paymoSpendingThresholdSection')) return true;
    const view = document.getElementById('notificationSettings');
    const saveStatus = document.getElementById('paymoNotificationSaveStatus');
    if (!view || !saveStatus) return false;

    const style = document.createElement('style');
    style.id = 'paymo-spending-threshold-style';
    style.textContent = [
      '.paymo-threshold-input{min-width:0;width:108px;max-width:30vw;height:40px;border:1px solid var(--theme-line);border-radius:10px;background:var(--surface);color:var(--page-fg);font:inherit;font-size:16px;font-weight:750;text-align:right;padding:0 8px}',
      '.paymo-threshold-input:disabled{opacity:.35}',
      '.paymo-threshold-note{margin:0;padding:0 17px 15px;color:var(--theme-muted);font-size:12px;line-height:1.55}',
      '.paymo-threshold-currency{font-weight:700;color:var(--page-fg)}'
    ].join('');
    document.head.appendChild(style);

    const section = document.createElement('div');
    section.id = 'paymoSpendingThresholdSection';
    section.innerHTML = [
      '<span class="paymo-notification-label">支出額の通知</span>',
      '<div class="paymo-notification-card">',
      '<div class="paymo-notification-row">',
      '<strong>月間の支出額</strong>',
      '<div class="paymo-notification-controls">',
      '<input id="paymoSpendingThresholdAmount" class="paymo-threshold-input" type="text" inputmode="numeric" autocomplete="off" aria-label="通知する支出額" placeholder="30,000" maxlength="18">',
      '<span class="paymo-threshold-currency">円</span>',
      '<label class="paymo-switch" aria-label="支出額の通知">',
      '<input id="paymoSpendingThresholdEnabled" type="checkbox">',
      '<span class="paymo-switch-track"></span>',
      '</label></div></div>',
      '<p class="paymo-threshold-note">今月の支出合計（利用日ベース）が設定額を超えたら通知します。通知は10分後（固定）、月に1回です。</p>',
      '</div>',
      '<small id="paymoSpendingThresholdStatus" class="paymo-notification-save-status"></small>'
    ].join('');
    saveStatus.before(section);

    const input = document.getElementById('paymoSpendingThresholdAmount');
    const toggle = document.getElementById('paymoSpendingThresholdEnabled');
    input?.addEventListener('change', () => {
      input.value = formatAmount(input.value);
      saveSettings();
    });
    toggle?.addEventListener('change', () => {
      if (toggle.checked && amountOf(input?.value) <= 0) {
        toggle.checked = false;
        status('先に通知する金額を入力してください');
        input?.focus();
        return;
      }
      syncState();
      saveSettings();
    });
    syncState();
    return true;
  }

  async function saveSettings() {
    if (!ensureControls()) return;
    if (saving) { saveQueued = true; return; }
    saving = true;
    do {
      saveQueued = false;
      const threshold = amountOf(document.getElementById('paymoSpendingThresholdAmount')?.value);
      const enabled = document.getElementById('paymoSpendingThresholdEnabled')?.checked === true;
      if (enabled && threshold <= 0) {
        status('1円以上の通知金額を入力してください');
        break;
      }
      status('保存中…');
      try {
        await api({ threshold, enabled });
        status('保存しました');
      } catch (error) {
        status(error.message);
      }
    } while (saveQueued);
    saving = false;
  }

  async function loadSettings() {
    if (loading || !ensureControls() || !token()) return;
    loading = true;
    try {
      const response = await api();
      const amount = document.getElementById('paymoSpendingThresholdAmount');
      const enabled = document.getElementById('paymoSpendingThresholdEnabled');
      if (amount) amount.value = formatAmount(response.settings?.threshold);
      if (enabled) enabled.checked = response.settings?.enabled === true;
      syncState();
      status('');
    } catch (error) {
      status(error.message);
    } finally {
      loading = false;
    }
  }

  function init() {
    ensureControls();
    loadSettings();
    document.addEventListener('click', (event) => {
      if (!event.target?.closest?.('#openNotifications')) return;
      setTimeout(() => { ensureControls(); loadSettings(); }, 0);
    }, true);
    new MutationObserver(ensureControls).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('paymo:authenticated', loadSettings);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();