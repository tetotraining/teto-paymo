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

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

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
      const statements = chunk.map((id) => context.env.DB.prepare(
        'DELETE FROM expenses WHERE owner_key = ? AND id = ?'
      ).bind(ownerKey, id));
      await context.env.DB.batch(statements);
    }
    return json({ ok: true, count: ids.length });
  } catch {
    return json({ error: 'database unavailable' }, 503);
  }
}
