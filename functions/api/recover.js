import { createRecoveryCode, createSession, ensureAuthSchema, hashPassword, json, sha } from '../_utils/auth.js';

const randomSalt = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
};

export async function onRequestPost(context) {
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  await ensureAuthSchema(context.env.DB);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const code = String(body?.code || '').trim().toUpperCase();
  const password = String(body?.password || '');
  if (!code) return json({ error: '復旧コードを入力してください' }, 400);
  if (password.length < 4) return json({ error: 'パスワードは4文字以上で入力してください' }, 400);

  const recovery = await context.env.DB.prepare(
    'SELECT r.user_id,u.login_id,u.nickname FROM recovery_codes r JOIN users u ON u.id=r.user_id WHERE r.code_hash=? AND r.used_at IS NULL'
  ).bind(await sha(code)).first();
  if (!recovery) return json({ error: '復旧コードが違います' }, 400);

  const salt = randomSalt();
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?')
      .bind(await hashPassword(password, salt), salt, recovery.user_id),
    context.env.DB.prepare('UPDATE recovery_codes SET used_at=? WHERE user_id=? AND used_at IS NULL')
      .bind(Date.now(), recovery.user_id),
    context.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(recovery.user_id)
  ]);

  const recoveryCode = await createRecoveryCode(context.env.DB, recovery.user_id);
  const token = await createSession(context.env.DB, recovery.user_id);
  return json({
    ok: true,
    token,
    recoveryCode,
    user: { id: recovery.user_id, loginId: recovery.login_id, nickname: recovery.nickname }
  });
}
