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

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function normalizeInstallments(value, totalAmount, fallbackDate) {
  const raw = Array.isArray(value?.installments) ? value.installments : [];
  const parts = raw.slice(0, 3).map((part) => ({
    date: String(part?.date || ''),
    amount: Math.round(Number(part?.amount || 0))
  })).filter((part) => validDate(part.date) && part.amount > 0);

  if (parts.length >= 1 && parts.length <= 3 && parts.reduce((sum, part) => sum + part.amount, 0) === totalAmount) return parts;
  return [{ date: fallbackDate, amount: totalAmount }];
}

function normalizeExpense(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id || '').slice(0, 100);
  const amount = Math.round(Number(value.amount));
  const payee = String(value.payee || '').slice(0, 100);
  const date = String(value.date || '');
  const usageDate = String(value.usageDate || value.usage_date || date);
  if (!id || !Number.isFinite(amount) || amount <= 0 || !payee || !validDate(date) || !validDate(usageDate)) return null;
  const installments = normalizeInstallments(value, amount, date);
  return { id, amount, payee, date: installments[0].date, usageDate, splitCount: installments.length, installments };
}

function hydrateExpense(row) {
  let installments = null;
  try {
    const parsed = JSON.parse(row.installments_json || 'null');
    if (Array.isArray(parsed)) installments = parsed;
  } catch {}
  return normalizeExpense({
    id: row.id,
    amount: row.amount,
    payee: row.payee,
    date: row.date,
    usageDate: row.usageDate || row.usage_date || row.date,
    splitCount: row.splitCount || row.split_count || 1,
    installments
  });
}

export async function onRequestGet(context) {
  const ownerKey = getOwnerKey(context.request);
  if (!ownerKey) return json({ error: 'unauthorized' }, 401);
  if (!context.env.DB) return json({ error: 'D1 binding DB is not configured' }, 503);

  try {
    const result = await context.env.DB.prepare(
      'SELECT id, amount, payee, date, COALESCE(usage_date, date) AS usageDate, COALESCE(split_count, 1) AS splitCount, installments_json FROM expenses WHERE owner_key = ? ORDER BY date DESC, created_at DESC'
    ).bind(ownerKey).all();
    return json({ expenses: (result.results || []).map(hydrateExpense).filter(Boolean) });
  } catch {
    try {
      const usageSchema = await context.env.DB.prepare(
        'SELECT id, amount, payee, date, COALESCE(usage_date, date) AS usageDate FROM expenses WHERE owner_key = ? ORDER BY date DESC, created_at DESC'
      ).bind(ownerKey).all();
      return json({ expenses: (usageSchema.results || []).map(hydrateExpense).filter(Boolean) });
    } catch {
      try {
        const legacy = await context.env.DB.prepare(
          'SELECT id, amount, payee, date FROM expenses WHERE owner_key = ? ORDER BY date DESC, created_at DESC'
        ).bind(ownerKey).all();
        return json({ expenses: (legacy.results || []).map(hydrateExpense).filter(Boolean) });
      } catch {
        return json({ error: 'database unavailable' }, 503);
      }
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
    const statements = expenses.map((expense) => context.env.DB.prepare(
      `INSERT INTO expenses (owner_key, id, amount, payee, date, usage_date, split_count, installments_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(owner_key, id) DO UPDATE SET
         amount = excluded.amount,
         payee = excluded.payee,
         date = excluded.date,
         usage_date = excluded.usage_date,
         split_count = excluded.split_count,
         installments_json = excluded.installments_json`
    ).bind(ownerKey, expense.id, expense.amount, expense.payee, expense.date, expense.usageDate, expense.splitCount, JSON.stringify(expense.installments)));
    await context.env.DB.batch(statements);
    return json({ ok: true, count: expenses.length });
  } catch {
    try {
      const usageStatements = expenses.map((expense) => context.env.DB.prepare(
        `INSERT INTO expenses (owner_key, id, amount, payee, date, usage_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(owner_key, id) DO UPDATE SET
           amount = excluded.amount,
           payee = excluded.payee,
           date = excluded.date,
           usage_date = excluded.usage_date`
      ).bind(ownerKey, expense.id, expense.amount, expense.payee, expense.date, expense.usageDate));
      await context.env.DB.batch(usageStatements);
      return json({ ok: true, count: expenses.length, legacySchema: true });
    } catch {
      try {
        const legacyStatements = expenses.map((expense) => context.env.DB.prepare(
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
}
