const encoder = new TextEncoder();
const ALLOWED_ORIGIN = 'https://teto-paymo.pages.dev';

function corsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  return {
    'access-control-allow-origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(request)
    }
  });
}

const b64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replaceAll('=', '');
const randomBytes = (size) => crypto.getRandomValues(new Uint8Array(size));

async function sha(value) {
  return b64(await crypto.subtle.digest('SHA-256', encoder.encode(String(value || ''))));
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: encoder.encode(salt),
    iterations: 100000,
    hash: 'SHA-256'
  }, key, 256));
}

const randomSalt = () => b64(randomBytes(16));

async function createSession(db, userId) {
  const raw = b64(randomBytes(32));
  const now = Date.now();
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .bind(await sha(raw), userId, now + 2592000000, now).run();
  return raw;
}

async function getUser(request, db) {
  const raw = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!raw) return null;
  const tokenHash = await sha(raw);
  return db.prepare(
    'SELECT u.id,u.login_id,u.nickname,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(tokenHash, Date.now()).first();
}

const recoveryAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRecoveryCode = () => Array.from(randomBytes(12), (value) => recoveryAlphabet[value % recoveryAlphabet.length]).join('');

async function createRecoveryCode(db, userId) {
  await db.prepare('DELETE FROM recovery_codes WHERE user_id=?').bind(userId).run();
  const code = newRecoveryCode();
  await db.prepare('INSERT INTO recovery_codes(code_hash,user_id,used_at,created_at) VALUES(?,?,NULL,?)')
    .bind(await sha(code), userId, Date.now()).run();
  return code;
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
  if (parts.length && parts.reduce((sum, part) => sum + part.amount, 0) === totalAmount) return parts;
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

function normalizePayees(value) {
  if (!Array.isArray(value)) return null;
  const result = [];
  for (const item of value.slice(0, 10)) {
    const name = String(item?.name || '').trim().slice(0, 30);
    const color = String(item?.color || '').trim();
    if (!name || !/^#[0-9a-fA-F]{6}$/.test(color)) continue;
    if (result.some((saved) => saved.name === name)) continue;
    result.push({ name, color });
  }
  return result;
}

async function saveSetting(db, userId, key, value) {
  await db.prepare(
    'INSERT INTO account_settings(user_id,setting_key,value_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,setting_key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at'
  ).bind(userId, key, JSON.stringify(value), Date.now()).run();
}

async function readSetting(db, userId, key) {
  const row = await db.prepare('SELECT value_json FROM account_settings WHERE user_id=? AND setting_key=?').bind(userId, key).first();
  if (!row?.value_json) return null;
  try { return JSON.parse(row.value_json); } catch { return null; }
}

async function requireUser(request, env) {
  if (!env.DB) return { response: json(request, { error: 'D1 binding DB is not configured' }, 503) };
  const user = await getUser(request, env.DB);
  if (!user) return { response: json(request, { error: '未ログインです' }, 401) };
  return { user };
}

async function register(request, env) {
  let body;
  try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
  const nickname = String(body?.nickname || '').trim().slice(0, 30);
  const loginId = String(body?.loginId || '').trim().slice(0, 64);
  const password = String(body?.password || '');
  if (!nickname || !loginId || password.length < 4) return json(request, { error: '入力内容を確認してください' }, 400);

  const userId = crypto.randomUUID();
  const salt = randomSalt();
  try {
    await env.DB.prepare('INSERT INTO users(id,login_id,nickname,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)')
      .bind(userId, loginId, nickname, await hashPassword(password, salt), salt, Date.now()).run();
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) return json(request, { error: 'このIDは使用されています' }, 409);
    return json(request, { error: 'アカウントを作成できませんでした' }, 500);
  }

  const payees = normalizePayees(body?.payees);
  if (payees) await saveSetting(env.DB, userId, 'payees', payees);
  const token = await createSession(env.DB, userId);
  const recoveryCode = await createRecoveryCode(env.DB, userId);
  return json(request, { token, user: { id: userId, loginId, nickname }, recoveryCode }, 201);
}

async function login(request, env) {
  let body;
  try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
  const loginId = String(body?.loginId || '').trim();
  const password = String(body?.password || '');
  const attemptKey = await sha(`${request.headers.get('cf-connecting-ip') || 'local'}|${loginId}`);
  const attempt = await env.DB.prepare('SELECT * FROM login_attempts WHERE key=?').bind(attemptKey).first();
  if (attempt?.blocked_until > Date.now()) return json(request, { error: 'しばらくしてから再度お試しください' }, 429);

  const user = await env.DB.prepare('SELECT * FROM users WHERE login_id=?').bind(loginId).first();
  const valid = Boolean(user) && await hashPassword(password, user.password_salt) === user.password_hash;
  if (!valid) {
    const failures = Number(attempt?.failures || 0) + 1;
    const blockedUntil = failures >= 5 ? Date.now() + 900000 : 0;
    await env.DB.prepare(
      'INSERT INTO login_attempts(key,failures,blocked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at'
    ).bind(attemptKey, failures, blockedUntil, Date.now()).run();
    return json(request, { error: 'IDまたはパスワードが違います' }, 401);
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(attemptKey).run();
  return json(request, { token: await createSession(env.DB, user.id), user: { id: user.id, loginId: user.login_id, nickname: user.nickname } });
}

async function recover(request, env) {
  let body;
  try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
  const code = String(body?.code || '').trim().toUpperCase();
  const password = String(body?.password || '');
  if (!code) return json(request, { error: '復旧コードを入力してください' }, 400);
  if (password.length < 4) return json(request, { error: 'パスワードは4文字以上で入力してください' }, 400);
  const recovery = await env.DB.prepare(
    'SELECT r.user_id,u.login_id,u.nickname FROM recovery_codes r JOIN users u ON u.id=r.user_id WHERE r.code_hash=? AND r.used_at IS NULL'
  ).bind(await sha(code)).first();
  if (!recovery) return json(request, { error: '復旧コードが違います' }, 400);

  const salt = randomSalt();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?').bind(await hashPassword(password, salt), salt, recovery.user_id),
    env.DB.prepare('UPDATE recovery_codes SET used_at=? WHERE user_id=? AND used_at IS NULL').bind(Date.now(), recovery.user_id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(recovery.user_id)
  ]);
  const recoveryCode = await createRecoveryCode(env.DB, recovery.user_id);
  const token = await createSession(env.DB, recovery.user_id);
  return json(request, { ok: true, token, recoveryCode, user: { id: recovery.user_id, loginId: recovery.login_id, nickname: recovery.nickname } });
}

async function expenses(request, env, user) {
  if (request.method === 'GET') {
    const result = await env.DB.prepare(
      `SELECT e.id,e.amount,e.payee,e.date,COALESCE(e.usage_date,e.date) AS usageDate,COALESCE(e.split_count,1) AS splitCount,e.installments_json,COALESCE(s.paid,0) AS paid
       FROM expenses e LEFT JOIN expense_status s ON s.owner_key=e.owner_key AND s.id=e.id
       WHERE e.owner_key=? ORDER BY e.date DESC,e.created_at DESC`
    ).bind(user.id).all();
    return json(request, { expenses: (result.results || []).map(hydrateExpense).filter(Boolean) });
  }

  let body;
  try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
  const raw = Array.isArray(body?.expenses) ? body.expenses : [body?.expense || body];
  const rows = raw.map(normalizeExpense).filter(Boolean);
  if (!rows.length) return json(request, { error: 'invalid expense' }, 400);
  if (rows.length > 500) return json(request, { error: 'too many expenses' }, 413);

  const statements = [];
  for (const expense of rows) {
    statements.push(env.DB.prepare(
      `INSERT INTO expenses(owner_key,id,amount,payee,date,usage_date,split_count,installments_json,created_at)
       VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(owner_key,id) DO UPDATE SET amount=excluded.amount,payee=excluded.payee,date=excluded.date,usage_date=excluded.usage_date,split_count=excluded.split_count,installments_json=excluded.installments_json`
    ).bind(user.id, expense.id, expense.amount, expense.payee, expense.date, expense.usageDate, expense.splitCount, JSON.stringify(expense.installments)));
    statements.push(env.DB.prepare(
      'INSERT INTO expense_status(owner_key,id,paid) VALUES(?,?,?) ON CONFLICT(owner_key,id) DO UPDATE SET paid=excluded.paid'
    ).bind(user.id, expense.id, expense.paid ? 1 : 0));
  }
  await env.DB.batch(statements);
  return json(request, { ok: true, count: rows.length });
}

async function deleteExpenses(request, env, user, pathname) {
  if (pathname === '/api/expenses/bulk-delete') {
    let body;
    try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
    const ids = Array.from(new Set((Array.isArray(body?.ids) ? body.ids : []).map((id) => String(id || '').slice(0, 100)).filter(Boolean)));
    if (!ids.length) return json(request, { error: 'invalid ids' }, 400);
    if (ids.length > 500) return json(request, { error: 'too many ids' }, 413);
    for (let start = 0; start < ids.length; start += 100) {
      const statements = [];
      ids.slice(start, start + 100).forEach((id) => {
        statements.push(env.DB.prepare('DELETE FROM expense_status WHERE owner_key=? AND id=?').bind(user.id, id));
        statements.push(env.DB.prepare('DELETE FROM expenses WHERE owner_key=? AND id=?').bind(user.id, id));
      });
      await env.DB.batch(statements);
    }
    return json(request, { ok: true, count: ids.length });
  }

  const match = pathname.match(/^\/api\/expenses\/([^/]+)$/);
  if (!match) return json(request, { error: 'not found' }, 404);
  const id = decodeURIComponent(match[1]).slice(0, 100);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM expense_status WHERE owner_key=? AND id=?').bind(user.id, id),
    env.DB.prepare('DELETE FROM expenses WHERE owner_key=? AND id=?').bind(user.id, id)
  ]);
  return json(request, { ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (!env.DB) return json(request, { error: 'D1 binding DB is not configured' }, 503);

    try {
      if (request.method === 'POST' && url.pathname === '/api/register') return await register(request, env);
      if (request.method === 'POST' && url.pathname === '/api/login') return await login(request, env);
      if (request.method === 'POST' && url.pathname === '/api/recover') return await recover(request, env);

      const auth = await requireUser(request, env);
      if (auth.response) return auth.response;
      const user = auth.user;

      if (request.method === 'GET' && url.pathname === '/api/me') {
        return json(request, { user: { id: user.id, loginId: user.login_id, nickname: user.nickname } });
      }
      if (request.method === 'POST' && url.pathname === '/api/logout') {
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();
        return json(request, { ok: true });
      }
      if (url.pathname === '/api/settings') {
        if (request.method === 'GET') return json(request, { payees: await readSetting(env.DB, user.id, 'payees') });
        if (request.method === 'POST') {
          let body;
          try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
          const payees = normalizePayees(body?.payees);
          if (!payees) return json(request, { error: 'invalid payees' }, 400);
          await saveSetting(env.DB, user.id, 'payees', payees);
          return json(request, { ok: true, payees });
        }
      }
      if (url.pathname === '/api/expenses' && (request.method === 'GET' || request.method === 'POST')) {
        return await expenses(request, env, user);
      }
      if (request.method === 'DELETE' && (url.pathname === '/api/expenses/bulk-delete' || /^\/api\/expenses\/[^/]+$/.test(url.pathname))) {
        return await deleteExpenses(request, env, user, url.pathname);
      }
      return json(request, { error: 'not found' }, 404);
    } catch (error) {
      console.error('Paymo account API error', error);
      return json(request, { error: 'server error' }, 500);
    }
  }
};
