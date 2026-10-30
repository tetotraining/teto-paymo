(() => {
  const TOKEN_KEY = 'paymo_token_v1';
  const EXPENSE_KEY = 'ready-expenses-v1';
  const PAYEE_KEY = 'paymo_payees_v1';
  const PENDING_DELETE_KEY = 'paymo-pending-delete-v1';
  let busy = false;

  function mode() {
    if (document.getElementById('paymoAuthNickname')) return 'register';
    if (document.getElementById('paymoAuthRecovery')) return 'recover';
    return 'login';
  }

  function showError(message) {
    const form = document.querySelector('#paymoAuthRoot .paymo-auth-form');
    if (!form) return;
    let box = document.getElementById('paymoAuthEnhancedError');
    if (!box) {
      box = document.createElement('div');
      box.id = 'paymoAuthEnhancedError';
      box.className = 'paymo-auth-error';
      form.before(box);
    }
    box.textContent = message || '通信エラー';
  }

  function clearAccountCache() {
    localStorage.removeItem(EXPENSE_KEY);
    localStorage.removeItem(PAYEE_KEY);
    localStorage.removeItem(PENDING_DELETE_KEY);
  }

  function installStyle() {
    if (document.getElementById('paymo-recovery-confirm-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-recovery-confirm-style';
    style.textContent = `
      #paymoRecoveryConfirm{position:fixed;inset:0;z-index:100000;background:var(--page-bg,#050605);color:var(--page-fg,#fff);display:flex;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top) + 28px) 22px calc(env(safe-area-inset-bottom) + 28px)}
      .paymo-recovery-card{width:min(100%,390px);display:grid;gap:18px}
      .paymo-recovery-kicker{font-size:13px;font-weight:900;letter-spacing:.16em;opacity:.5}
      .paymo-recovery-title{font-size:34px;line-height:1.05;font-weight:950;letter-spacing:-1px;margin:0}
      .paymo-recovery-copy{font-size:13px;line-height:1.65;opacity:.6;margin:0}
      .paymo-recovery-code{font-size:24px;line-height:1.2;font-weight:950;letter-spacing:.12em;text-align:center;padding:20px 14px;border-radius:18px;background:color-mix(in srgb,var(--page-fg,#fff) 8%,transparent);word-break:break-all}
      .paymo-recovery-button{min-height:54px;border:0;border-radius:17px;font-size:15px;font-weight:950}
      #paymoRecoveryCopy{background:color-mix(in srgb,var(--page-fg,#fff) 10%,transparent);color:inherit}
      #paymoRecoveryContinue{background:var(--accent,#B9F486);color:var(--accent-ink,#101010)}
      .paymo-recovery-status{min-height:18px;text-align:center;font-size:12px;font-weight:800;opacity:.55}
    `;
    document.head.appendChild(style);
  }

  function showRecovery(code) {
    installStyle();
    document.getElementById('paymoRecoveryConfirm')?.remove();
    const root = document.createElement('div');
    root.id = 'paymoRecoveryConfirm';
    root.innerHTML = `<div class="paymo-recovery-card">
      <div class="paymo-recovery-kicker">PAYMO</div>
      <h2 class="paymo-recovery-title">復旧コードを保存</h2>
      <p class="paymo-recovery-copy">パスワードを忘れた時に必要です。コピーして安全な場所へ保存してください。</p>
      <div class="paymo-recovery-code" id="paymoRecoveryCode"></div>
      <button class="paymo-recovery-button" id="paymoRecoveryCopy" type="button">復旧コードをコピー</button>
      <div class="paymo-recovery-status" id="paymoRecoveryStatus"></div>
      <button class="paymo-recovery-button" id="paymoRecoveryContinue" type="button">保存したので続ける</button>
    </div>`;
    document.body.appendChild(root);
    document.getElementById('paymoRecoveryCode').textContent = code;
    document.getElementById('paymoRecoveryCopy').onclick = async () => {
      const status = document.getElementById('paymoRecoveryStatus');
      try {
        await navigator.clipboard.writeText(code);
        status.textContent = 'コピーしました';
      } catch {
        const area = document.createElement('textarea');
        area.value = code;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        status.textContent = 'コピーしました';
      }
    };
    document.getElementById('paymoRecoveryContinue').onclick = () => location.reload();
  }

  async function submitEnhanced() {
    const currentMode = mode();
    if (currentMode === 'login' || busy) return false;
    busy = true;
    const submit = document.getElementById('paymoAuthSubmit');
    if (submit) submit.disabled = true;
    try {
      const password = document.getElementById('paymoAuthPassword')?.value || '';
      if (password.length < 4) throw new Error('パスワードは4文字以上で入力してください');
      let path;
      let body;
      if (currentMode === 'register') {
        const nickname = document.getElementById('paymoAuthNickname')?.value.trim() || '';
        const loginId = document.getElementById('paymoAuthLoginId')?.value.trim() || '';
        if (!nickname || !loginId) throw new Error('入力内容を確認してください');
        let payees = [];
        try { payees = JSON.parse(localStorage.getItem(PAYEE_KEY) || '[]'); } catch {}
        path = 'register';
        body = { nickname, loginId, password, legacyKey: localStorage.getItem('paymo-d1-client-key-v1') || '', payees };
      } else {
        const code = document.getElementById('paymoAuthRecovery')?.value.trim() || '';
        const password2 = document.getElementById('paymoAuthPassword2')?.value || '';
        if (!code) throw new Error('復旧コードを入力してください');
        if (password !== password2) throw new Error('パスワードが一致しません');
        path = 'recover';
        body = { code, password };
      }

      const response = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store'
      });
      let result = {};
      try { result = await response.json(); } catch {}
      if (!response.ok) throw new Error(result.error || '通信エラー');
      if (!result.token || !result.recoveryCode) throw new Error('アカウント情報を確認できませんでした');
      if (currentMode === 'recover') clearAccountCache();
      localStorage.setItem(TOKEN_KEY, result.token);
      showRecovery(result.recoveryCode);
      return true;
    } catch (error) {
      showError(error.message || '通信エラー');
      return true;
    } finally {
      busy = false;
      if (submit) submit.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target?.closest?.('#paymoAuthSubmit')) return;
    if (mode() === 'login') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submitEnhanced();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !event.target?.closest?.('#paymoAuthRoot')) return;
    if (mode() === 'login') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submitEnhanced();
  }, true);
})();
