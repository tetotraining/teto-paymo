(() => {
  const MARKER_KEY = 'paymo_push_key_v1';
  const DEFAULTS = {
    sameDayTime: '09:00',
    oneDayTime: '09:00',
    twoDaysTime: '09:00',
    sameDayEnabled: true,
    oneDayEnabled: true,
    twoDaysEnabled: true
  };
  let loading = false;

  const token = () => typeof window.paymoGetAuthToken === 'function' ? window.paymoGetAuthToken() : localStorage.getItem('paymo_token_v1') || '';

  async function api(path, body, method = body ? 'POST' : 'GET') {
    const auth = token();
    const response = await fetch(`/api/${path}`, {
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

  function b64u(value) {
    const pad = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  }

  function showView(id) {
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  }

  function injectStyle() {
    if (document.getElementById('paymo-notification-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-notification-style';
    style.textContent = `
      .paymo-notification-head{display:flex;align-items:center;gap:10px;margin-bottom:18px}
      .paymo-notification-back{width:38px;height:38px;border:0;border-radius:50%;background:transparent!important;color:var(--page-fg)!important;font-size:30px;line-height:1;display:grid;place-items:center;padding:0}
      .paymo-notification-title{margin:0;font-size:30px;font-weight:900;letter-spacing:-1px;color:var(--page-fg)!important}
      .paymo-notification-label{display:block;color:var(--theme-muted)!important;font-size:14px;font-weight:400;margin:18px 0 8px}
      .paymo-notification-card{background:var(--surface)!important;color:var(--page-fg)!important;border-radius:18px;overflow:hidden}
      .paymo-notification-row{min-height:70px;padding:0 17px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--theme-line)}
      .paymo-notification-row:first-child{border-top:0}
      .paymo-notification-row strong{font-size:17px;font-weight:650;white-space:nowrap}
      .paymo-notification-controls{display:flex;align-items:center;justify-content:flex-end;gap:12px;min-width:0}
      .paymo-notification-time{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:var(--page-fg);font:inherit;font-size:16px;font-weight:700;text-align:right;width:88px;outline:none;color-scheme:dark;transition:opacity .18s ease}
      .paymo-notification-time:disabled{opacity:.32}
      html[data-theme="light"] .paymo-notification-time{color-scheme:light}
      .paymo-switch{position:relative;display:inline-flex;width:50px;height:30px;flex:0 0 50px;cursor:pointer}
      .paymo-switch input{position:absolute;opacity:0;pointer-events:none}
      .paymo-switch-track{position:absolute;inset:0;border-radius:999px;background:var(--theme-line);transition:background .2s ease}
      .paymo-switch-track::after{content:"";position:absolute;width:26px;height:26px;left:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.28);transition:transform .2s cubic-bezier(.22,.72,.24,1)}
      .paymo-switch input:checked + .paymo-switch-track{background:var(--accent)}
      .paymo-switch input:checked + .paymo-switch-track::after{transform:translateX(20px)}
      .paymo-notification-save-status,.paymo-push-status{display:block;min-height:20px;margin:8px 3px 0;color:var(--theme-muted);font-size:12px;line-height:1.5}
      .paymo-push-button{width:100%;min-height:54px;border:0;border-radius:17px;background:var(--accent);color:var(--accent-ink);font-size:16px;font-weight:900;padding:0 16px}
      .paymo-push-button:disabled{opacity:.55}
    `;
    document.head.appendChild(style);
  }

  function notificationRow(label, timeId, toggleId) {
    return `
      <div class="paymo-notification-row">
        <strong>${label}</strong>
        <div class="paymo-notification-controls">
          <input id="${timeId}" class="paymo-notification-time" type="time" value="09:00">
          <label class="paymo-switch" aria-label="${label}の通知">
            <input id="${toggleId}" type="checkbox" checked>
            <span class="paymo-switch-track"></span>
          </label>
        </div>
      </div>`;
  }

  function ensureView() {
    injectStyle();
    let view = document.getElementById('notificationSettings');
    if (view) return view;
    const app = document.querySelector('.app');
    if (!app) return null;
    view = document.createElement('section');
    view.id = 'notificationSettings';
    view.className = 'view paymo-notification-view';
    view.setAttribute('data-no-page-swipe', '');
    view.innerHTML = `
      <div class="paymo-notification-head">
        <button id="paymoNotificationBack" class="paymo-notification-back" aria-label="戻る">‹</button>
        <h1 class="paymo-notification-title">通知設定</h1>
      </div>
      <span class="paymo-notification-label">支払期日の通知</span>
      <div class="paymo-notification-card">
        ${notificationRow('当日', 'paymoSameDayTime', 'paymoSameDayEnabled')}
        ${notificationRow('1日前', 'paymoOneDayTime', 'paymoOneDayEnabled')}
        ${notificationRow('2日前', 'paymoTwoDaysTime', 'paymoTwoDaysEnabled')}
      </div>
      <small id="paymoNotificationSaveStatus" class="paymo-notification-save-status"></small>
      <span class="paymo-notification-label">iPhoneの通知</span>
      <button id="paymoEnablePush" class="paymo-push-button" type="button">通知を有効にする</button>
      <small id="paymoPushStatus" class="paymo-push-status"></small>
    `;
    app.appendChild(view);
    document.getElementById('paymoNotificationBack').onclick = () => showView('menu');
    ['paymoSameDayTime', 'paymoOneDayTime', 'paymoTwoDaysTime'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', saveSettings);
    });
    ['paymoSameDayEnabled', 'paymoOneDayEnabled', 'paymoTwoDaysEnabled'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        syncRowStates();
        saveSettings();
      });
    });
    document.getElementById('paymoEnablePush').onclick = enablePush;
    syncRowStates();
    return view;
  }

  function syncRowStates() {
    const pairs = [
      ['paymoSameDayEnabled', 'paymoSameDayTime'],
      ['paymoOneDayEnabled', 'paymoOneDayTime'],
      ['paymoTwoDaysEnabled', 'paymoTwoDaysTime']
    ];
    pairs.forEach(([toggleId, timeId]) => {
      const toggle = document.getElementById(toggleId);
      const time = document.getElementById(timeId);
      if (toggle && time) time.disabled = !toggle.checked;
    });
  }

  function readSettings() {
    return {
      sameDayTime: document.getElementById('paymoSameDayTime')?.value || DEFAULTS.sameDayTime,
      oneDayTime: document.getElementById('paymoOneDayTime')?.value || DEFAULTS.oneDayTime,
      twoDaysTime: document.getElementById('paymoTwoDaysTime')?.value || DEFAULTS.twoDaysTime,
      sameDayEnabled: document.getElementById('paymoSameDayEnabled')?.checked !== false,
      oneDayEnabled: document.getElementById('paymoOneDayEnabled')?.checked !== false,
      twoDaysEnabled: document.getElementById('paymoTwoDaysEnabled')?.checked !== false
    };
  }

  async function saveSettings() {
    const status = document.getElementById('paymoNotificationSaveStatus');
    if (status) status.textContent = '保存中…';
    try {
      await api('notification-settings', readSettings());
      if (status) status.textContent = '保存しました';
      setTimeout(() => { if (status?.textContent === '保存しました') status.textContent = ''; }, 1500);
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  async function loadSettings() {
    if (loading) return;
    loading = true;
    const status = document.getElementById('paymoNotificationSaveStatus');
    try {
      const data = await api('notification-settings');
      const settings = { ...DEFAULTS, ...(data.settings || {}) };
      const values = {
        paymoSameDayTime: settings.sameDayTime,
        paymoOneDayTime: settings.oneDayTime,
        paymoTwoDaysTime: settings.twoDaysTime
      };
      Object.entries(values).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.value = value;
      });
      const toggles = {
        paymoSameDayEnabled: settings.sameDayEnabled,
        paymoOneDayEnabled: settings.oneDayEnabled,
        paymoTwoDaysEnabled: settings.twoDaysEnabled
      };
      Object.entries(toggles).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.checked = value !== false;
      });
      syncRowStates();
      if (status) status.textContent = '';
    } catch (error) {
      if (status) status.textContent = error.message;
    } finally {
      loading = false;
    }
  }

  async function ensureSubscription(force = false) {
    if (!token() || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const { publicKey } = await api('push/public-key');
    if (!publicKey) throw new Error('通知の準備が完了していません');

    let subscription = await registration.pushManager.getSubscription();
    const savedKey = localStorage.getItem(MARKER_KEY) || '';
    if (subscription && (force || savedKey !== publicKey)) {
      await api('push/subscriptions', { endpoint: subscription.endpoint }, 'DELETE').catch(() => {});
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64u(publicKey)
      });
    }
    await api('push/subscriptions', { subscription: subscription.toJSON() });
    localStorage.setItem(MARKER_KEY, publicKey);
    return true;
  }

  async function refreshPushStatus() {
    const button = document.getElementById('paymoEnablePush');
    const status = document.getElementById('paymoPushStatus');
    if (!button || !status) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      button.disabled = true;
      status.textContent = 'この端末では通知を利用できません';
      return;
    }
    if (Notification.permission === 'denied') {
      button.disabled = true;
      status.textContent = 'iPhoneの設定でPaymoの通知を許可してください';
      return;
    }
    try {
      const ok = await ensureSubscription(false);
      if (ok) {
        button.textContent = 'iPhoneの通知：ON';
        button.disabled = true;
        status.textContent = 'この端末では通知が有効です';
      } else {
        button.textContent = '通知を有効にする';
        button.disabled = false;
        status.textContent = '';
      }
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message;
    }
  }

  async function enablePush() {
    const button = document.getElementById('paymoEnablePush');
    const status = document.getElementById('paymoPushStatus');
    if (!button || !status) return;
    button.disabled = true;
    status.textContent = '設定中…';
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('iPhoneの通知が許可されていません');
      const ok = await ensureSubscription(true);
      if (!ok) throw new Error('通知を有効にできませんでした');
      button.textContent = 'iPhoneの通知：ON';
      status.textContent = 'この端末では通知が有効です';
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message;
    }
  }

  async function openSettings() {
    ensureView();
    showView('notificationSettings');
    await loadSettings();
    await refreshPushStatus();
  }

  function bindMenu() {
    ensureView();
    const button = document.getElementById('openNotifications');
    if (!button || button.dataset.paymoNotificationBound === '1') return;
    button.dataset.paymoNotificationBound = '1';
    button.onclick = openSettings;
  }

  function init() {
    bindMenu();
    new MutationObserver(bindMenu).observe(document.body, { childList: true, subtree: true });
    if ('Notification' in window && Notification.permission === 'granted') ensureSubscription(false).catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
