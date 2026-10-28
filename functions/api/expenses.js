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

export async function onRequestGet(context) {
  const ownerKey = getOwnerKey(context.request);
  if (!ownerKey) return json({ error: 'unauthorized' }, 401);
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);

  try {
    const result = await context.env.DB.prepare(
      'SELECT id, amount, payee, date, COALESCE(usage_date, date) AS usageDate FROM expenses WHERE owner_key = ? ORDER BY date DESC, created_at DESC'
    ).bind(ownerKey).all();
    return json({ expenses: result.results || [] });
  } catch {
    try {
      const legacy = await context.env.DB.prepare(
        'SELECT id, amount, payee, date FROM expenses WHERE owner_key = ? ORDER BY date DESC, created_at DESC'
      ).bind(ownerKey).all();
      return json({ expenses: (legacy.results || []).map(row => ({ ...row, usageDate: row.date })) });
    } catch {
      return json({ error: 'database unavailable' }, 503);
    }
  }
}

export async function onRequestPost(context) {
  const ownerKey = getOwnerKey(context.request);
  if (!ownerKey) return json({ error: 'unauthorized' }, 401);
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const raw = Array.isArray(body?.expenses) ? body.expenses : [body?.expense || body];
  const expenses = raw.map(normalizeExpense).filter(Boolean);
  if (!expenses.length) return json({ error: 'invalid expense' }, 400);
  if (expenses.length > 500) return json({ error: 'too many expenses' }, 413);

  try {
    const statements = expenses.map(expense => context.env.DB.prepare(
      `INSERT INTO expenses (owner_key, id, amount, payee, date, usage_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(owner_key, id) DO UPDATE SET
         amount = excluded.amount,
         payee = excluded.payee,
         date = excluded.date,
         usage_date = excluded.usage_date`
    ).bind(ownerKey, expense.id, expense.amount, expense.payee, expense.date, expense.usageDate));
    await context.env.DB.batch(statements);
    return json({ ok: true, count: expenses.length });
  } catch {
    try {
      const legacyStatements = expenses.map(expense => context.env.DB.prepare(
        `INSERT INTO expenses (owner_key, id, amount, payee, date, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(owner_key, id) DO UPDATE SET
           amount = excluded.amount,
           payee = excluded.payee,
           date = excluded.date`
      ).bind(ownerKey, expense.id, expense.amount, expense.payee, expense.date));
      await context.env.DB.batch(legacyStatements);
      return json({ ok: true, count: expenses.length, legacySchema: true });
    } catch {
      return json({ error: 'database unavailable' }, 503);
    }
  }
}
