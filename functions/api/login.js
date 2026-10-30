import { createSession, ensureAuthSchema, hashPassword, json, sha } from '../_utils/auth.js';

export async function onRequestPost(context) {
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  await ensureAuthSchema(context.env.DB);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const loginId = String(body?.loginId || '').trim();
  const password = String(body?.password || '');
  const key = await sha(`${context.request.headers.get('cf-connecting-ip') || 'local'}|${loginId}`);
  const attempt = await context.env.DB.prepare('SELECT * FROM login_attempts WHERE key=?').bind(key).first();
  if (attempt?.blocked_until > Date.now()) return json({ error: 'しばらくしてから再度お試しください' }, 429);

  const user = await context.env.DB.prepare('SELECT * FROM users WHERE login_id=?').bind(loginId).first();
  const valid = Boolean(user) && await hashPassword(password, user.password_salt) === user.password_hash;
  if (!valid) {
    const failures = Number(attempt?.failures || 0) + 1;
    const blockedUntil = failures >= 5 ? Date.now() + 900000 : 0;
    await context.env.DB.prepare(
      'INSERT INTO login_attempts(key,failures,blocked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at'
    ).bind(key, failures, blockedUntil, Date.now()).run();
    return json({ error: 'IDまたはパスワードが違います' }, 401);
  }

  await context.env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
  return json({
    token: await createSession(context.env.DB, user.id),
    user: { id: user.id, loginId: user.login_id, nickname: user.nickname }
  });
}
