import { getUser, json, normalizePayees, readSetting, saveSetting } from '../_utils/auth.js';

export async function onRequestGet(context) {
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const user = await getUser(context.request, context.env.DB);
  if (!user) return json({ error: '未ログインです' }, 401);
  return json({ payees: await readSetting(context.env.DB, user.id, 'payees') });
}

export async function onRequestPost(context) {
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const user = await getUser(context.request, context.env.DB);
  if (!user) return json({ error: '未ログインです' }, 401);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const payees = normalizePayees(body?.payees);
  if (!payees) return json({ error: 'invalid payees' }, 400);
  await saveSetting(context.env.DB, user.id, 'payees', payees);
  return json({ ok: true, payees });
}
