(() => {
  const DEFAULT_TIME = '09:00';
  let loading = false;

  const token = () => typeof window.paymoGetAuthToken === 'function'
    ? window.paymoGetAuthToken()
    : localStorage.getItem('paymo_token_v1') || '';

  function normalizeHour(value, fallback = DEFAULT_TIME) {
    const match = String(value || '').match(/^(\d{1,2}):/);
    if (!match) return fallback;
    const hour = Number(match[1]);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return fallback;
    return `${String(hour).padStart(2, '0')}:00`;
  }

  function hourOptions() {
    return Array.from({ length: 24 }, (_, index) => {
      const displayHour = index + 1;
      const value = displayHour === 24 ? '00:00' : `${String(displayHour).padStart(2, '0')}:00`;
      const label = displayHour === 24 ? '24時（0時）' : `${displayHour}時`;
      return `<option value="${value}">${label}</option>`;
    }).join('');
  }

  async function api(body, method = body ? 'POST' : 'GET') {
    const auth = token();
    const response = await fetch('/api/monthly-summary-settings', {
      method,
      headers: {
        'content-type': 'application/json',
        ...(auth ? { authorization: `Bearer ${auth}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || '通信エラー');
    return data;
  }

  function status(message = '') {
    const el = document.getElementById('paymoNotificationSaveStatus');
    if (el) el.textContent = message;
  }

  function syncState() {
    const toggle = document.getElementById('paymoMonthlySummaryEnabled');
    const time = document.getElementById('paymoMonthlySummaryTime');
    if (toggle && time) time.disabled = !toggle.checked;
  }

  function ensureControls() {
    if (document.getElementById('paymoMonthlySummarySection')) return true;
    const view = document.getElementById('notificationSettings');
    const saveStatus = document.getElementById('paymoNotificationSaveStatus');
    if (!view || !saveStatus) return false;

    const section = document.createElement('div');
    section.id = 'paymoMonthlySummarySection';
    section.innerHTML = `
      <span class="paymo-notification-label">月次の通知</span>
      <div class="paymo-notification-card">
        <div class="paymo-notification-row">
          <strong>前月の支払い額</strong>
          <div class="paymo-notification-controls">
            <select id="paymoMonthlySummaryTime" class="paymo-notification-time" aria-label="前月の支払い額の通知時刻">${hourOptions()}</select>
            <label class="paymo-switch" aria-label="前月の支払い額の通知">
              <input id="paymoMonthlySummaryEnabled" type="checkbox" checked>
              <span class="paymo-switch-track"></span>
            </label>
          </div>
        </div>
      </div>`;
    saveStatus.before(section);

    const time = document.getElementById('paymoMonthlySummaryTime');
    const toggle = document.getElementById('paymoMonthlySummaryEnabled');
    if (time) time.value = DEFAULT_TIME;
    time?.addEventListener('change', saveSettings);
    toggle?.addEventListener('change', () => {
      syncState();
      saveSettings();
    });
    syncState();
    return true;
  }

  async function saveSettings() {
    if (!ensureControls()) return;
    const time = normalizeHour(document.getElementById('paymoMonthlySummaryTime')?.value);
    const enabled = document.getElementById('paymoMonthlySummaryEnabled')?.checked !== false;
    status('保存中…');
    try {
      await api({ notifyTime: time, enabled });
      status('保存しました');
      setTimeout(() => {
        const el = document.getElementById('paymoNotificationSaveStatus');
        if (el?.textContent === '保存しました') el.textContent = '';
      }, 1500);
    } catch (error) {
      status(error.message);
    }
  }

  async function loadSettings() {
    if (loading || !ensureControls() || !token()) return;
    loading = true;
    try {
      const data = await api();
      const settings = data.settings || {};
      const time = document.getElementById('paymoMonthlySummaryTime');
      const toggle = document.getElementById('paymoMonthlySummaryEnabled');
      if (time) time.value = normalizeHour(settings.notifyTime, DEFAULT_TIME);
      if (toggle) toggle.checked = settings.enabled !== false;
      syncState();
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
      setTimeout(() => {
        ensureControls();
        loadSettings();
      }, 0);
    }, true);

    new MutationObserver(() => ensureControls()).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
