(() => {
  const TOKEN_KEY = 'paymo_token_v1';
  const ACCOUNT_KEYS = [
    TOKEN_KEY,
    'ready-expenses-v1',
    'paymo_payees_v1',
    'paymo-pending-delete-v1',
    'paymo-dirty-expenses-v1',
    'paymo-account-hydrated-v1'
  ];
  let deleting = false;

  function removeLoginCopy() {
    const root = document.getElementById('paymoAuthRoot');
    if (!root || root.hidden) return;
    const title = root.querySelector('.paymo-auth-title')?.textContent?.trim();
    const copy = root.querySelector('.paymo-auth-copy');
    if (title === 'ログイン' && copy?.textContent?.includes('端末をまたいで同じデータ')) copy.remove();
  }

  function keepAccountFirst() {
    const list = document.querySelector('#menu .menu-list');
    const account = document.getElementById('openPaymoAccount');
    if (!list || !account) return;
    if (list.firstElementChild !== account) list.prepend(account);
  }

  function enhanceAccountSheet() {
    const sheet = document.getElementById('paymoAccountSheet');
    if (!sheet || sheet.hidden || sheet.querySelector('#paymoDeleteAccount')) return;
    const button = document.createElement('button');
    button.id = 'paymoDeleteAccount';
    button.className = 'paymo-account-delete';
    button.type = 'button';
    button.textContent = 'アカウントを削除';
    button.addEventListener('click', openDeleteConfirm);
    const logout = sheet.querySelector('#paymoLogout');
    if (logout) sheet.insertBefore(button, logout);
    else sheet.appendChild(button);
  }

  function ensureDeleteConfirm() {
    let backdrop = document.getElementById('paymoDeleteConfirmBackdrop');
    let sheet = document.getElementById('paymoDeleteConfirmSheet');
    if (backdrop && sheet) return { backdrop, sheet };

    backdrop = document.createElement('div');
    backdrop.id = 'paymoDeleteConfirmBackdrop';
    backdrop.className = 'paymo-delete-confirm-backdrop';
    backdrop.hidden = true;

    sheet = document.createElement('section');
    sheet.id = 'paymoDeleteConfirmSheet';
    sheet.className = 'paymo-delete-confirm-sheet';
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="paymo-delete-confirm-grab"></div>
      <h2 class="paymo-delete-confirm-title">アカウントを削除しますか？</h2>
      <p class="paymo-delete-confirm-copy">支出履歴・項目設定など、このアカウントに紐付くデータはすべて削除され、元に戻せません。</p>
      <div id="paymoDeleteConfirmError" class="paymo-delete-confirm-error" hidden></div>
      <button id="paymoDeleteConfirmButton" class="paymo-delete-confirm-danger" type="button">削除する</button>
      <button id="paymoDeleteCancelButton" class="paymo-delete-confirm-cancel" type="button">キャンセル</button>
    `;
    document.body.append(backdrop, sheet);
    backdrop.addEventListener('click', closeDeleteConfirm);
    sheet.querySelector('#paymoDeleteCancelButton')?.addEventListener('click', closeDeleteConfirm);
    sheet.querySelector('#paymoDeleteConfirmButton')?.addEventListener('click', deleteAccount);
    return { backdrop, sheet };
  }

  function openDeleteConfirm() {
    const { backdrop, sheet } = ensureDeleteConfirm();
    const error = sheet.querySelector('#paymoDeleteConfirmError');
    const confirmButton = sheet.querySelector('#paymoDeleteConfirmButton');
    const cancelButton = sheet.querySelector('#paymoDeleteCancelButton');
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.textContent = '削除する';
    }
    if (cancelButton) cancelButton.disabled = false;
    backdrop.hidden = false;
    sheet.hidden = false;
  }

  function closeDeleteConfirm() {
    if (deleting) return;
    document.getElementById('paymoDeleteConfirmBackdrop')?.setAttribute('hidden', '');
    document.getElementById('paymoDeleteConfirmSheet')?.setAttribute('hidden', '');
  }

  async function deleteAccount() {
    if (deleting) return;
    deleting = true;
    const sheet = document.getElementById('paymoDeleteConfirmSheet');
    const confirmButton = document.getElementById('paymoDeleteConfirmButton');
    const cancelButton = document.getElementById('paymoDeleteCancelButton');
    const errorBox = document.getElementById('paymoDeleteConfirmError');
    const accountButton = document.getElementById('paymoDeleteAccount');

    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = '削除中…';
    }
    if (cancelButton) cancelButton.disabled = true;
    if (accountButton) accountButton.disabled = true;
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    try {
      const token = typeof window.paymoGetAuthToken === 'function'
        ? window.paymoGetAuthToken()
        : localStorage.getItem(TOKEN_KEY) || '';
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(data.error || 'アカウントを削除できませんでした');
      ACCOUNT_KEYS.forEach((key) => localStorage.removeItem(key));
      location.reload();
    } catch (error) {
      deleting = false;
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = '削除する';
      }
      if (cancelButton) cancelButton.disabled = false;
      if (accountButton) accountButton.disabled = false;
      if (errorBox) {
        errorBox.textContent = error?.message || 'アカウントを削除できませんでした';
        errorBox.hidden = false;
      }
      if (sheet) sheet.scrollTop = 0;
    }
  }

  function installStyle() {
    if (document.getElementById('paymo-account-controls-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-account-controls-style';
    style.textContent = `
      .paymo-account-delete{width:100%;border:0;border-radius:17px;padding:15px;margin-top:14px;background:#E63946;color:#fff;font-weight:900;font-size:15px}
      .paymo-account-delete:disabled{opacity:.48}
      .paymo-account-delete + .paymo-account-logout{margin-top:10px}
      .paymo-delete-confirm-backdrop{position:fixed;z-index:9200;inset:0;background:#0009;backdrop-filter:blur(2px)}
      .paymo-delete-confirm-backdrop[hidden],.paymo-delete-confirm-sheet[hidden]{display:none!important}
      .paymo-delete-confirm-sheet{position:fixed;z-index:9201;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,430px);box-sizing:border-box;background:var(--surface,#f7f7f5);color:var(--ink,#111);border-radius:28px 28px 0 0;padding:10px 18px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px #0005}
      .paymo-delete-confirm-grab{width:45px;height:5px;background:#bbb;border-radius:9px;margin:0 auto 18px}
      .paymo-delete-confirm-title{font-size:24px;line-height:1.25;font-weight:950;margin:0 0 10px}
      .paymo-delete-confirm-copy{font-size:13px;line-height:1.65;color:#777;margin:0 0 18px}
      .paymo-delete-confirm-error{border-radius:14px;background:rgba(230,57,70,.11);color:#E63946;padding:11px 13px;margin:0 0 12px;font-size:13px;font-weight:800;line-height:1.45}
      .paymo-delete-confirm-danger,.paymo-delete-confirm-cancel{width:100%;min-height:52px;border:0;border-radius:17px;font-size:15px;font-weight:900}
      .paymo-delete-confirm-danger{background:#E63946;color:#fff}
      .paymo-delete-confirm-cancel{margin-top:9px;background:rgba(127,127,127,.12);color:inherit}
      .paymo-delete-confirm-danger:disabled,.paymo-delete-confirm-cancel:disabled{opacity:.48}
    `;
    document.head.appendChild(style);
  }

  function refresh() {
    removeLoginCopy();
    keepAccountFirst();
    enhanceAccountSheet();
  }

  installStyle();
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('#openPaymoAccount')) requestAnimationFrame(enhanceAccountSheet);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
})();
