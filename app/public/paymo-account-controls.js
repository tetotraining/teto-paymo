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
    button.addEventListener('click', deleteAccount);
    sheet.appendChild(button);
  }

  async function deleteAccount() {
    const ok = confirm('アカウントを削除しますか？\n支出履歴・項目設定など、このアカウントに紐付くデータはすべて削除され、元に戻せません。');
    if (!ok) return;

    const button = document.getElementById('paymoDeleteAccount');
    if (button) {
      button.disabled = true;
      button.textContent = '削除中…';
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
      alert(error?.message || 'アカウントを削除できませんでした');
      if (button) {
        button.disabled = false;
        button.textContent = 'アカウントを削除';
      }
    }
  }

  function installStyle() {
    if (document.getElementById('paymo-account-controls-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-account-controls-style';
    style.textContent = `
      .paymo-account-delete{width:100%;border:0;border-radius:17px;padding:15px;margin-top:10px;background:#E63946;color:#fff;font-weight:900;font-size:15px}
      .paymo-account-delete:disabled{opacity:.48}
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
