import { getUser, json } from '../../_utils/auth.js';

export async function onRequestDelete(context) {
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const user = await getUser(context.request, context.env.DB);
  if (!user) return json({ error: '未ログインです' }, 401);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const ids = Array.from(new Set(
    (Array.isArray(body?.ids) ? body.ids : [])
      .map((id) => String(id || '').slice(0, 100))
      .filter(Boolean)
  ));

  if (!ids.length) return json({ error: 'invalid ids' }, 400);
  if (ids.length > 500) return json({ error: 'too many ids' }, 413);

  try {
    for (let start = 0; start < ids.length; start += 100) {
      const chunk = ids.slice(start, start + 100);
      const statements = [];
      chunk.forEach((id) => {
        statements.push(context.env.DB.prepare('DELETE FROM expense_status WHERE owner_key=? AND id=?').bind(user.id, id));
        statements.push(context.env.DB.prepare('DELETE FROM expenses WHERE owner_key=? AND id=?').bind(user.id, id));
      });
      await context.env.DB.batch(statements);
    }
    return json({ ok: true, count: ids.length });
  } catch {
    return json({ error: 'database unavailable' }, 503);
  }
}
