const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

function getOwnerKey(request) {
  const key = request.headers.get('x-paymo-key') || '';
  return /^[A-Za-z0-9_-]{24,128}$/.test(key) ? key : null;
}

export async function onRequestDelete(context) {
  const ownerKey = getOwnerKey(context.request);
  if (!ownerKey) return json({ error: 'unauthorized' }, 401);
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);

  const id = String(context.params?.id || '').slice(0, 100);
  if (!id) return json({ error: 'invalid id' }, 400);

  try {
    await context.env.DB.prepare('DELETE FROM expenses WHERE owner_key = ? AND id = ?')
      .bind(ownerKey, id).run();
    return json({ ok: true });
  } catch {
    return json({ error: 'database unavailable' }, 503);
  }
}
