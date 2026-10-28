const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=UTF-8',
    'cache-control': 'no-store'
  }
});

function ownerKey(request) {
  const key = request.headers.get('x-paymo-key') || '';
  return /^[A-Za-z0-9_-]{24,128}$/.test(key) ? key : null;
}

function normalizeExpense(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id || '').slice(0, 100);
  const amount = Number(value.amount);
  const payee = String(value.payee || '').slice(0, 100);
  const date = String(value.date || '');
  const usageDate = String(value.usageDate || value.usage_date || date);
  if (!id || !Number.isFinite(amount) || amount <= 0 || !payee || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(usageDate)) return null;
  return { id, amount: Math.round(amount), payee, date, usageDate };
}

async function expensesApi(request, env, url) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);
  const key = ownerKey(request);
  if (!key) return json({ error: 'unauthorized' }, 401);

  if (request.method === 'GET' && url.pathname === '/api/expenses') {
    const result = await env.DB.prepare(
      'SELECT id, amount, payee, date, COALESCE(usage_date, date) AS usageDate FROM expenses WHERE owner_key = ? ORDER BY date DESC, created_at DESC'
    ).bind(key).all();
    return json({ expenses: result.results || [] });
  }

  if (request.method === 'POST' && url.pathname === '/api/expenses') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    const raw = Array.isArray(body?.expenses) ? body.expenses : [body?.expense || body];
    const rows = raw.map(normalizeExpense).filter(Boolean);
    if (!rows.length) return json({ error: 'invalid expense' }, 400);
    if (rows.length > 500) return json({ error: 'too many expenses' }, 413);

    const statements = rows.map((expense) => env.DB.prepare(
      `INSERT INTO expenses (owner_key, id, amount, payee, date, usage_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(owner_key, id) DO UPDATE SET
         amount = excluded.amount,
         payee = excluded.payee,
         date = excluded.date,
         usage_date = excluded.usage_date`
    ).bind(key, expense.id, expense.amount, expense.payee, expense.date, expense.usageDate));
    await env.DB.batch(statements);
    return json({ ok: true, count: rows.length });
  }

  const match = url.pathname.match(/^\/api\/expenses\/([^/]+)$/);
  if (request.method === 'DELETE' && match) {
    await env.DB.prepare('DELETE FROM expenses WHERE owner_key = ? AND id = ?')
      .bind(key, decodeURIComponent(match[1])).run();
    return json({ ok: true });
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/expenses' || url.pathname.startsWith('/api/expenses/')) {
        return await expensesApi(request, env, url);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Paymo worker error', error);
      if (url.pathname.startsWith('/api/')) return json({ error: 'server error' }, 500);
      return env.ASSETS.fetch(request);
    }
  }
};
