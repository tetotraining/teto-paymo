import { getUser, json } from '../../_utils/auth.js';

export async function onRequestDelete(context) {
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const user = await getUser(context.request, context.env.DB);
  if (!user) return json({ error: '未ログインです' }, 401);

  const id = String(context.params?.id || '').slice(0, 100);
  if (!id) return json({ error: 'invalid id' }, 400);

  try {
    await context.env.DB.batch([
      context.env.DB.prepare('DELETE FROM expense_status WHERE owner_key=? AND id=?').bind(user.id, id),
      context.env.DB.prepare('DELETE FROM expenses WHERE owner_key=? AND id=?').bind(user.id, id)
    ]);
    return json({ ok: true });
  } catch {
    return json({ error: 'database unavailable' }, 503);
  }
}
