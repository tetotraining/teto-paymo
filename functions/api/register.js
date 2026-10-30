import { createRecoveryCode, createSession, ensureAuthSchema, hashPassword, json, normalizePayees, saveSetting, validLegacyKey } from '../_utils/auth.js';

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

  const nickname = String(body?.nickname || '').trim().slice(0, 30);
  const loginId = String(body?.loginId || '').trim().slice(0, 64);
  const password = String(body?.password || '');
  if (!nickname || !loginId || password.length < 4) return json({ error: '入力内容を確認してください' }, 400);

  const userId = crypto.randomUUID();
  const salt = randomSalt();
  try {
    await context.env.DB.prepare(
      'INSERT INTO users(id,login_id,nickname,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)'
    ).bind(userId, loginId, nickname, await hashPassword(password, salt), salt, Date.now()).run();
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) return json({ error: 'このIDは使用されています' }, 409);
    return json({ error: 'アカウントを作成できませんでした' }, 500);
  }

  const legacyKey = String(body?.legacyKey || '');
  if (validLegacyKey(legacyKey)) {
    try {
      await context.env.DB.prepare('UPDATE expenses SET owner_key=? WHERE owner_key=?').bind(userId, legacyKey).run();
      await context.env.DB.prepare('UPDATE expense_status SET owner_key=? WHERE owner_key=?').bind(userId, legacyKey).run();
    } catch {}
  }

  const payees = normalizePayees(body?.payees);
  if (payees) await saveSetting(context.env.DB, userId, 'payees', payees);

  const token = await createSession(context.env.DB, userId);
  const recoveryCode = await createRecoveryCode(context.env.DB, userId);
  return json({ token, user: { id: userId, loginId, nickname }, recoveryCode }, 201);
}
