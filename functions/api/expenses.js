import { getUser, json } from '../_utils/auth.js';

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
  const paid = value?.paid === true || value?.paid === 1 || value?.paid === '1';
  return { id, amount, payee, date: installments[0].date, usageDate, splitCount: installments.length, installments, paid };
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
    installments,
    paid: row.paid
  });
}

async function ownerOf(context) {
  if (!context.env.DB) return { error: json({ error: 'D1 binding DB is not configured' }, 503) };
  const user = await getUser(context.request, context.env.DB);
  if (!user) return { error: json({ error: '未ログインです' }, 401) };
  return { ownerKey: user.id };
}

export async function onRequestGet(context) {
  const auth = await ownerOf(context);
  if (auth.error) return auth.error;
  const ownerKey = auth.ownerKey;

  try {
    const result = await context.env.DB.prepare(
      `SELECT e.id,e.amount,e.payee,e.date,COALESCE(e.usage_date,e.date) AS usageDate,COALESCE(e.split_count,1) AS splitCount,e.installments_json,COALESCE(s.paid,0) AS paid
       FROM expenses e LEFT JOIN expense_status s ON s.owner_key=e.owner_key AND s.id=e.id
       WHERE e.owner_key=? ORDER BY e.date DESC,e.created_at DESC`
    ).bind(ownerKey).all();
    return json({ expenses: (result.results || []).map(hydrateExpense).filter(Boolean) });
  } catch {
    try {
      const usageSchema = await context.env.DB.prepare(
        `SELECT e.id,e.amount,e.payee,e.date,COALESCE(e.usage_date,e.date) AS usageDate,COALESCE(s.paid,0) AS paid
         FROM expenses e LEFT JOIN expense_status s ON s.owner_key=e.owner_key AND s.id=e.id
         WHERE e.owner_key=? ORDER BY e.date DESC,e.created_at DESC`
      ).bind(ownerKey).all();
      return json({ expenses: (usageSchema.results || []).map(hydrateExpense).filter(Boolean) });
    } catch {
      try {
        const legacy = await context.env.DB.prepare(
          `SELECT e.id,e.amount,e.payee,e.date,COALESCE(s.paid,0) AS paid
           FROM expenses e LEFT JOIN expense_status s ON s.owner_key=e.owner_key AND s.id=e.id
           WHERE e.owner_key=? ORDER BY e.date DESC,e.created_at DESC`
        ).bind(ownerKey).all();
        return json({ expenses: (legacy.results || []).map(hydrateExpense).filter(Boolean) });
      } catch {
        return json({ error: 'database unavailable' }, 503);
      }
    }
  }
}

export async function onRequestPost(context) {
  const auth = await ownerOf(context);
  if (auth.error) return auth.error;
  const ownerKey = auth.ownerKey;

  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const raw = Array.isArray(body?.expenses) ? body.expenses : [body?.expense || body];
  const expenses = raw.map(normalizeExpense).filter(Boolean);
  if (!expenses.length) return json({ error: 'invalid expense' }, 400);
  if (expenses.length > 500) return json({ error: 'too many expenses' }, 413);

  const statusStatements = expenses.map((expense) => context.env.DB.prepare(
    `INSERT INTO expense_status(owner_key,id,paid) VALUES(?,?,?)
     ON CONFLICT(owner_key,id) DO UPDATE SET paid=excluded.paid`
  ).bind(ownerKey, expense.id, expense.paid ? 1 : 0));

  try {
    const statements = expenses.map((expense) => context.env.DB.prepare(
      `INSERT INTO expenses (owner_key,id,amount,payee,date,usage_date,split_count,installments_json,created_at)
       VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(owner_key,id) DO UPDATE SET
         amount=excluded.amount,payee=excluded.payee,date=excluded.date,usage_date=excluded.usage_date,
         split_count=excluded.split_count,installments_json=excluded.installments_json`
    ).bind(ownerKey, expense.id, expense.amount, expense.payee, expense.date, expense.usageDate, expense.splitCount, JSON.stringify(expense.installments)));
    await context.env.DB.batch([...statements, ...statusStatements]);
    return json({ ok: true, count: expenses.length });
  } catch {
    try {
      const usageStatements = expenses.map((expense) => context.env.DB.prepare(
        `INSERT INTO expenses (owner_key,id,amount,payee,date,usage_date,created_at)
         VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
         ON CONFLICT(owner_key,id) DO UPDATE SET amount=excluded.amount,payee=excluded.payee,date=excluded.date,usage_date=excluded.usage_date`
      ).bind(ownerKey, expense.id, expense.amount, expense.payee, expense.date, expense.usageDate));
      await context.env.DB.batch([...usageStatements, ...statusStatements]);
      return json({ ok: true, count: expenses.length, legacySchema: true });
    } catch {
      try {
        const legacyStatements = expenses.map((expense) => context.env.DB.prepare(
          `INSERT INTO expenses (owner_key,id,amount,payee,date,created_at)
           VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
           ON CONFLICT(owner_key,id) DO UPDATE SET amount=excluded.amount,payee=excluded.payee,date=excluded.date`
        ).bind(ownerKey, expense.id, expense.amount, expense.payee, expense.date));
        await context.env.DB.batch([...legacyStatements, ...statusStatements]);
        return json({ ok: true, count: expenses.length, legacySchema: true });
      } catch {
        return json({ error: 'database unavailable' }, 503);
      }
    }
  }
}
