(() => {
  const TOKEN_KEY = 'paymo_token_v1';
  const LEGACY_KEY = 'paymo-d1-client-key-v1';
  const EXPENSE_KEY = 'ready-expenses-v1';
  const PAYEE_KEY = 'paymo_payees_v1';
  const PENDING_DELETE_KEY = 'paymo-pending-delete-v1';
  let token = localStorage.getItem(TOKEN_KEY) || '';
  let user = null;
  let authRoot = null;

  window.paymoGetAuthToken = () => token;
  window.paymoCurrentUser = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  async function request(path, body, method = body ? 'POST' : 'GET', withAuth = false) {
    const response = await fetch(`/api/${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(withAuth && token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || '通信エラー');
    return data;
  }

  function clearAccountCache() {
    localStorage.removeItem(EXPENSE_KEY);
    localStorage.removeItem(PAYEE_KEY);
    localStorage.removeItem(PENDING_DELETE_KEY);
  }

  function installStyle() {
    if (document.getElementById('paymo-auth-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-auth-style';
    style.textContent = `
      html.paymo-auth-locked,html.paymo-auth-locked body{overflow:hidden!important}
      #paymoAuthRoot{position:fixed;inset:0;z-index:99998;background:var(--page-bg,#050605);color:var(--page-fg,#fff);display:flex;justify-content:center;overflow:auto;padding:calc(env(safe-area-inset-top) + 48px) 22px calc(env(safe-area-inset-bottom) + 40px)}
      #paymoAuthRoot[hidden]{display:none!important}
      .paymo-auth-wrap{width:min(100%,390px);margin:auto 0;display:grid;gap:22px}
      .paymo-auth-brand{font-size:13px;font-weight:900;letter-spacing:.18em;opacity:.52}
      .paymo-auth-title{font-size:38px;line-height:1.05;letter-spacing:-1.5px;font-weight:950;margin:0}
      .paymo-auth-copy{font-size:13px;line-height:1.6;opacity:.58;margin:-8px 0 0}
      .paymo-auth-form{display:grid;gap:11px}
      .paymo-auth-input{width:100%;min-height:54px;border:1px solid color-mix(in srgb,var(--page-fg,#fff) 13%,transparent);border-radius:17px;background:color-mix(in srgb,var(--page-fg,#fff) 7%,transparent);color:inherit;padding:0 16px;outline:none;font-size:16px}
      .paymo-auth-input::placeholder{color:inherit;opacity:.38}
      .paymo-auth-input:focus{border-color:color-mix(in srgb,var(--accent,#B9F486) 65%,transparent)}
      .paymo-auth-primary{min-height:54px;border:0;border-radius:17px;background:var(--accent,#B9F486);color:var(--accent-ink,#101010);font-size:16px;font-weight:950;margin-top:3px}
      .paymo-auth-link{min-height:44px;border:0;background:transparent;color:inherit;font-weight:800;opacity:.64;padding:8px}
      .paymo-auth-error{border-radius:14px;background:rgba(230,57,70,.13);color:#E63946;padding:11px 13px;font-size:13px;font-weight:800;line-height:1.45}
      .paymo-account-sheet{position:fixed;z-index:9001;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,430px);background:var(--surface,#f7f7f5);color:var(--ink,#111);border-radius:28px 28px 0 0;padding:10px 18px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px #0004}
      .paymo-account-sheet[hidden]{display:none!important}.paymo-account-backdrop{position:fixed;z-index:9000;inset:0;background:#0008}.paymo-account-backdrop[hidden]{display:none!important}
      .paymo-account-grab{width:45px;height:5px;background:#bbb;border-radius:9px;margin:0 auto 18px}.paymo-account-title{font-size:25px;font-weight:950;margin:0 0 18px}.paymo-account-card{background:#fff;border-radius:18px;padding:14px 15px;display:grid;gap:4px}.paymo-account-card strong{font-size:16px}.paymo-account-card small{font-size:12px;color:#777}.paymo-account-logout{width:100%;border:0;border-radius:17px;padding:15px;margin-top:14px;background:rgba(230,57,70,.11);color:#E63946;font-weight:900;font-size:15px}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    installStyle();
    if (authRoot) return authRoot;
    authRoot = document.createElement('div');
    authRoot.id = 'paymoAuthRoot';
    authRoot.hidden = true;
    document.body.appendChild(authRoot);
    return authRoot;
  }

  function renderAuth(mode = 'login', message = '') {
    const root = ensureRoot();
    document.documentElement.classList.add('paymo-auth-locked');
    root.hidden = false;
    const register = mode === 'register';
    const recover = mode === 'recover';
    root.innerHTML = `<div class="paymo-auth-wrap">
      <div class="paymo-auth-brand">PAYMO</div>
      <h1 class="paymo-auth-title">${register ? 'アカウント登録' : recover ? '復旧コード' : 'ログイン'}</h1>
      <p class="paymo-auth-copy">${register ? 'このアカウントに支出データを紐付けます。別端末でも同じIDで利用できます。' : recover ? '保存してある復旧コードからパスワードを再設定します。' : '同じアカウントでログインすると、端末をまたいで同じデータを利用できます。'}</p>
      ${message ? `<div class="paymo-auth-error">${escapeHtml(message)}</div>` : ''}
      <div class="paymo-auth-form">
        ${register ? '<input id="paymoAuthNickname" class="paymo-auth-input" maxlength="30" autocomplete="nickname" placeholder="ニックネーム">' : ''}
        ${recover ? '<input id="paymoAuthRecovery" class="paymo-auth-input" autocomplete="off" placeholder="復旧コード">' : '<input id="paymoAuthLoginId" class="paymo-auth-input" maxlength="64" autocomplete="username" placeholder="ログインID">'}
        <input id="paymoAuthPassword" class="paymo-auth-input" type="password" minlength="4" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="パスワード（4文字以上）">
        ${recover ? '<input id="paymoAuthPassword2" class="paymo-auth-input" type="password" minlength="4" autocomplete="new-password" placeholder="パスワードを再入力">' : ''}
        <button id="paymoAuthSubmit" class="paymo-auth-primary" type="button">${register ? '登録する' : recover ? 'パスワードを変更' : 'ログイン'}</button>
        <button class="paymo-auth-link" type="button" data-auth-mode="${mode === 'login' ? 'register' : 'login'}">${mode === 'login' ? 'アカウントを作成' : 'ログインへ戻る'}</button>
        ${mode === 'login' ? '<button class="paymo-auth-link" type="button" data-auth-mode="recover">復旧コードを使う</button>' : ''}
      </div>
    </div>`;

    root.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => renderAuth(button.dataset.authMode)));
    root.querySelector('#paymoAuthSubmit')?.addEventListener('click', () => submitAuth(mode));
    root.querySelectorAll('input').forEach((input) => input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); submitAuth(mode); }
    }));
  }

  function currentPayees() {
    try {
      const value = JSON.parse(localStorage.getItem(PAYEE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  async function submitAuth(mode) {
    const password = document.getElementById('paymoAuthPassword')?.value || '';
    if (password.length < 4) return renderAuth(mode, 'パスワードは4文字以上で入力してください');
    const submit = document.getElementById('paymoAuthSubmit');
    if (submit) submit.disabled = true;
    try {
      let result;
      if (mode === 'register') {
        const nickname = document.getElementById('paymoAuthNickname')?.value.trim() || '';
        const loginId = document.getElementById('paymoAuthLoginId')?.value.trim() || '';
        if (!nickname || !loginId) throw new Error('入力内容を確認してください');
        result = await request('register', {
          nickname,
          loginId,
          password,
          legacyKey: localStorage.getItem(LEGACY_KEY) || '',
          payees: currentPayees()
        });
        token = result.token;
        localStorage.setItem(TOKEN_KEY, token);
        alert(`復旧コード：${result.recoveryCode}\n必ず保管してください`);
        location.reload();
        return;
      }
      if (mode === 'recover') {
        const code = document.getElementById('paymoAuthRecovery')?.value.trim() || '';
        const password2 = document.getElementById('paymoAuthPassword2')?.value || '';
        if (password !== password2) throw new Error('パスワードが一致しません');
        result = await request('recover', { code, password });
        clearAccountCache();
        token = result.token;
        localStorage.setItem(TOKEN_KEY, token);
        alert(`変更しました。新しい復旧コード：${result.recoveryCode}\n必ず保管してください`);
        location.reload();
        return;
      }
      const loginId = document.getElementById('paymoAuthLoginId')?.value.trim() || '';
      if (!loginId) throw new Error('ログインIDを入力してください');
      result = await request('login', { loginId, password });
      clearAccountCache();
      token = result.token;
      localStorage.setItem(TOKEN_KEY, token);
      location.reload();
    } catch (error) {
      renderAuth(mode, error.message || '通信エラー');
    }
  }

  function closeAuth() {
    ensureRoot().hidden = true;
    document.documentElement.classList.remove('paymo-auth-locked');
  }

  function ensureAccountSheet() {
    if (document.getElementById('paymoAccountSheet')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'paymoAccountBackdrop';
    backdrop.className = 'paymo-account-backdrop';
    backdrop.hidden = true;
    const sheet = document.createElement('section');
    sheet.id = 'paymoAccountSheet';
    sheet.className = 'paymo-account-sheet';
    sheet.hidden = true;
    document.body.append(backdrop, sheet);
    backdrop.addEventListener('click', closeAccountSheet);
  }

  function openAccountSheet() {
    ensureAccountSheet();
    const backdrop = document.getElementById('paymoAccountBackdrop');
    const sheet = document.getElementById('paymoAccountSheet');
    if (!backdrop || !sheet) return;
    sheet.innerHTML = `<div class="paymo-account-grab"></div><h2 class="paymo-account-title">アカウント</h2><div class="paymo-account-card"><strong>${escapeHtml(user?.nickname || '')}</strong><small>@${escapeHtml(user?.loginId || '')}</small></div><button id="paymoLogout" class="paymo-account-logout" type="button">ログアウト</button>`;
    backdrop.hidden = false;
    sheet.hidden = false;
    document.getElementById('paymoLogout')?.addEventListener('click', logout);
  }

  function closeAccountSheet() {
    document.getElementById('paymoAccountBackdrop')?.setAttribute('hidden', '');
    document.getElementById('paymoAccountSheet')?.setAttribute('hidden', '');
  }

  async function logout() {
    try { await request('logout', {}, 'POST', true); } catch {}
    localStorage.removeItem(TOKEN_KEY);
    clearAccountCache();
    token = '';
    location.reload();
  }

  function attachAccountMenu() {
    const list = document.querySelector('#menu .menu-list');
    if (!list || document.getElementById('openPaymoAccount')) return false;
    const button = document.createElement('button');
    button.id = 'openPaymoAccount';
    button.className = 'menu-item';
    button.innerHTML = '<span>アカウント</span><span>›</span>';
    list.appendChild(button);
    button.addEventListener('click', openAccountSheet);
    return true;
  }

  async function boot() {
    ensureRoot();
    if (!token) {
      renderAuth('login');
      return;
    }
    try {
      const result = await request('me', null, 'GET', true);
      user = result.user;
      window.paymoCurrentUser = user;
      closeAuth();
      ensureAccountSheet();
      attachAccountMenu();
      const observer = new MutationObserver(() => attachAccountMenu());
      observer.observe(document.body, { childList: true, subtree: true });
      window.dispatchEvent(new CustomEvent('paymo:authenticated', { detail: { user } }));
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      token = '';
      renderAuth('login', 'ログインしてください');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
