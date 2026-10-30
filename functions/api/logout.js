import { getUser, json } from '../_utils/auth.js';

export async function onRequestPost(context) {
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const user = await getUser(context.request, context.env.DB);
  if (!user) return json({ error: '未ログインです' }, 401);
  await context.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();
  return json({ ok: true });
}
