(() => {
  'use strict';
  const ENDPOINT = '/api/spending-threshold-settings';
  const DEFAULT_THRESHOLD = 30000;
  const MAX_THRESHOLD = 1000000000000;
  const CACHE_PREFIX = 'paymo-spending-threshold-settings-v2:';
  const SAVE_DEBOUNCE_MS = 450;
  let loading = false;
  let saving = false;
  let saveQueued = false;
  let editVersion = 0;
  let inputTimer = 0;

  const token = () => typeof window.paymoGetAuthToken === 'function'
    ? window.paymoGetAuthToken()
    : localStorage.getItem('paymo_token_v1') || '';

  // The cache is scoped by account ID. Never carry a spending limit
  // from one Paymo account to another on a shared device.
  const cacheKey = () => {
    const id = String(window.paymoCurrentUser?.id || '');
    return id ? CACHE_PREFIX + id : '';
  };

  function status(message = '') {
    const element = document.getElementById('paymoSpendingThresholdStatus');
    if (element) element.textContent = message;
  }

  function amountOf(value) {
    const digits = String(value ?? '').replace(/[^0-9]/g, '');
    if (!digits) return 0;
    const amount = Number(digits);
    return Number.isSafeInteger(amount) ? amount : NaN;
  }

  function formatAmount(value) {
    const amount = amountOf(value);
    return Number.isFinite(amount) && amount > 0 ? amount.toLocaleString('ja-JP') : '';
  }

  function normalized(value) {
    const threshold = Number(value?.threshold);
    if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > MAX_THRESHOLD) return null;
    if (typeof value?.enabled !== 'boolean') return null;
    return { threshold, enabled: value.enabled };
  }

  function readCache() {
    const key = cacheKey();
    if (!key) return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      const settings = normalized(parsed);
      if (!settings) return null;
      return {
        ...settings,
        pending: parsed?.pending === true,
        revision: Number(parsed?.revision || 0)
      };
    } catch {
      return null;
    }
  }

  function writeCache(settings) {
    const key = cacheKey();
    if (!key) return false;
    try {
      localStorage.setItem(key, JSON.stringify(settings));
      return true;
    } catch {
      return false;
    }
  }

  function showSettings(settings) {
    const amount = document.getElementById('paymoSpendingThresholdAmount');
    const toggle = document.getElementById('paymoSpendingThresholdEnabled');
    if (amount) amount.value = formatAmount(settings.threshold);
    if (toggle) toggle.checked = settings.enabled;
  }

  function settingsFromView() {
    return {
      threshold: amountOf(document.getElementById('paymoSpendingThresholdAmount')?.value),
      enabled: document.getElementById('paymoSpendingThresholdEnabled')?.checked === true
    };
  }

  async function api(body) {
    const authorization = token();
    if (!authorization) throw new Error('ログインしてください');
    const response = await fetch(ENDPOINT, {
      method: body ? 'POST' : 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + authorization
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload.error || '通知サーバーに接続できません（HTTP ' + response.status + '）');
    const settings = normalized(payload.settings);
    if (!settings || (body && (settings.threshold !== body.threshold || settings.enabled !== body.enabled))) {
      throw new Error('サーバーから正しい通知設定を確認できませんでした');
    }
    return settings;
  }

  function ensureControls() {
    if (document.getElementById('paymoSpendingThresholdSection')) return true;
    const view = document.getElementById('notificationSettings');
    const saveStatus = document.getElementById('paymoNotificationSaveStatus');
    if (!view || !saveStatus) return false;

    if (!document.getElementById('paymo-spending-threshold-style')) {
      const style = document.createElement('style');
      style.id = 'paymo-spending-threshold-style';
      style.textContent = [
        '.paymo-threshold-input{min-width:0;width:108px;max-width:30vw;height:40px;border:1px solid var(--theme-line);border-radius:10px;background:var(--surface);color:var(--page-fg);font:inherit;font-size:16px;font-weight:750;text-align:right;padding:0 8px}',
        '.paymo-threshold-note{margin:0;padding:0 17px 15px;color:var(--theme-muted);font-size:12px;line-height:1.55}',
        '.paymo-threshold-currency{font-weight:700;color:var(--page-fg)}'
      ].join('');
      document.head.appendChild(style);
    }

    const section = document.createElement('div');
    section.id = 'paymoSpendingThresholdSection';
    section.innerHTML = [
      '<span class="paymo-notification-label">支出額の通知</span>',
      '<div class="paymo-notification-card">',
      '<div class="paymo-notification-row">',
      '<strong>月間の支出額</strong>',
      '<div class="paymo-notification-controls">',
      '<input id="paymoSpendingThresholdAmount" class="paymo-threshold-input" type="text" inputmode="numeric" autocomplete="off" aria-label="通知する支出額" value="30,000" maxlength="18">',
      '<span class="paymo-threshold-currency">円</span>',
      '<label class="paymo-switch" aria-label="支出額の通知">',
      '<input id="paymoSpendingThresholdEnabled" type="checkbox" checked>',
      '<span class="paymo-switch-track"></span>',
      '</label></div></div>',
      '<p class="paymo-threshold-note">今月の支出合計額が設定額を超えたら通知します。</p>',
      '</div>',
      '<small id="paymoSpendingThresholdStatus" class="paymo-notification-save-status" role="status" aria-live="polite"></small>'
    ].join('');
    saveStatus.before(section);

    const input = document.getElementById('paymoSpendingThresholdAmount');
    const toggle = document.getElementById('paymoSpendingThresholdEnabled');

    // Save while typing too: iPhone does not always blur the field when
    // navigating away. Input is saved locally first, then synced to the API.
    input?.addEventListener('input', () => {
      clearTimeout(inputTimer);
      saveSettings(false); // retain the entered amount immediately, including before blur
      inputTimer = setTimeout(syncPending, SAVE_DEBOUNCE_MS);
    });
    input?.addEventListener('change', () => {
      clearTimeout(inputTimer);
      input.value = formatAmount(input.value);
      saveSettings();
    });
    toggle?.addEventListener('change', () => {
      clearTimeout(inputTimer);
      saveSettings();
    });
    return true;
  }

  // Persist the user's latest choice synchronously, independent of the
  // network. Pending changes must never be overwritten by a stale GET.
  function saveSettings(sync = true) {
    if (!ensureControls()) return;
    const settings = settingsFromView();
    if (!normalized(settings) || (settings.enabled && settings.threshold === 0)) {
      status('1円以上の通知金額を入力してください');
      return;
    }
    const existing = readCache();
    const pending = {
      ...settings,
      pending: true,
      revision: (existing?.revision || 0) + 1
    };
    editVersion += 1;
    if (!writeCache(pending)) {
      status('端末に保存できませんでした。ログイン状態をご確認ください');
      return;
    }
    status('この端末に保存しました。通知サーバーへの反映を確認中…');
    if (sync) syncPending();
  }

  async function syncPending() {
    if (!cacheKey() || !token()) return;
    if (saving) {
      saveQueued = true;
      return;
    }
    saving = true;
    try {
      do {
        saveQueued = false;
        const key = cacheKey();
        const settings = readCache();
        if (!settings?.pending) break;
        try {
          await api({ threshold: settings.threshold, enabled: settings.enabled });
          if (cacheKey() !== key) break;
          const latest = readCache();
          if (latest && latest.revision === settings.revision &&
              latest.threshold === settings.threshold && latest.enabled === settings.enabled) {
            writeCache({ ...latest, pending: false });
            status('通知設定を保存しました');
          } else {
            saveQueued = true;
          }
        } catch {
          if (cacheKey() === key) {
            status('金額はこの端末に保存済みです。通知サーバーには未反映のため、通知は変更されていません');
          }
          break;
        }
      } while (saveQueued);
    } finally {
      saving = false;
    }
  }

  async function loadSettings() {
    if (loading || !ensureControls() || !token() || !cacheKey()) return;
    loading = true;
    const owner = cacheKey();
    const startingEdits = editVersion;
    const local = readCache();
    if (local && !document.getElementById('paymoSpendingThresholdAmount')?.matches(':focus')) {
      showSettings(local);
      if (local.pending) status('端末に保存済み・通知サーバーへの反映待ち');
    }
    try {
      const remote = await api();
      if (cacheKey() !== owner) return;
      const recent = readCache();
      if (editVersion !== startingEdits || recent?.pending) {
        await syncPending();
        return;
      }
      showSettings(remote);
      writeCache({ ...remote, pending: false, revision: recent?.revision || 0 });
      status('');
    } catch {
      if (cacheKey() !== owner) return;
      const pending = readCache()?.pending;
      status(pending
        ? '金額はこの端末に保存済みです。通知サーバーには未反映です'
        : '通知サーバーに接続できません。設定金額の適用状況を確認できません');
    } finally {
      loading = false;
    }
  }

  function openSettings() {
    if (!ensureControls()) return;
    const local = readCache();
    if (local) showSettings(local);
    loadSettings();
    if (local?.pending) syncPending();
  }

  function init() {
    ensureControls();
    openSettings();
    document.addEventListener('click', event => {
      if (!event.target?.closest?.('#openNotifications')) return;
      setTimeout(openSettings, 0);
    }, true);
    new MutationObserver(ensureControls).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('paymo:authenticated', openSettings);
    window.addEventListener('online', () => {
      if (readCache()?.pending) syncPending();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && readCache()?.pending) syncPending();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();