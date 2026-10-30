import base from './account-api.js';

const encoder = new TextEncoder();
const b64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replaceAll('=', '');

async function sha(value) {
  return b64(await crypto.subtle.digest('SHA-256', encoder.encode(String(value || ''))));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

async function deleteAccount(request, env) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const raw = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!raw) return json({ error: '未ログインです' }, 401);

  const tokenHash = await sha(raw);
  const user = await env.DB.prepare(
    'SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(tokenHash, Date.now()).first();
  if (!user?.id) return json({ error: '未ログインです' }, 401);

  const userId = user.id;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM expense_status WHERE owner_key=?').bind(userId),
    env.DB.prepare('DELETE FROM expenses WHERE owner_key=?').bind(userId),
    env.DB.prepare('DELETE FROM account_settings WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM recovery_codes WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id=?').bind(userId)
  ]);
  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'DELETE' && url.pathname === '/api/account') {
      try {
        return await deleteAccount(request, env);
      } catch (error) {
        console.error('Paymo account deletion error', error);
        return json({ error: 'アカウントを削除できませんでした' }, 500);
      }
    }
    return base.fetch(request, env, ctx);
  }
};
