import { getUser, json } from '../_utils/auth.js';

export async function onRequestGet(context) {
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const user = await getUser(context.request, context.env.DB);
  if (!user) return json({ error: '未ログインです' }, 401);
  return json({ user: { id: user.id, loginId: user.login_id, nickname: user.nickname } });
}
