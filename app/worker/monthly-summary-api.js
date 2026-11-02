import { buildPushPayload } from '@block65/webcrypto-web-push';

const encoder = new TextEncoder();
const ALLOWED_ORIGIN = 'https://teto-paymo.pages.dev';
const DEFAULT_TIME = '09:00';

function corsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  return {
    'access-control-allow-origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'Origin'
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

async function sha(value) {
  return b64(await crypto.subtle.digest('SHA-256', encoder.encode(String(value || ''))));
}

async function getUser(request, db) {
  const raw = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!raw) return null;
  return db.prepare(
    'SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(await sha(raw), Date.now()).first();
}

function validTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function toMinutes(value) {
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + m;
}

async function ensureSettings(db, userId) {
  await db.prepare(
    `INSERT OR IGNORE INTO monthly_summary_notification_settings(user_id,notify_time,enabled,updated_at)
     VALUES(?,?,1,?)`
  ).bind(userId, DEFAULT_TIME, Date.now()).run();
  return db.prepare(
    'SELECT notify_time,enabled FROM monthly_summary_notification_settings WHERE user_id=?'
  ).bind(userId).first();
}

export async function handleMonthlySummaryFetch(request, env, url) {
  if (url.pathname !== '/api/monthly-summary-settings') return null;
  if (!env.DB) return json(request, { error: 'D1 binding DB is not configured' }, 503);

  const user = await getUser(request, env.DB);
  if (!user?.id) return json(request, { error: '未ログインです' }, 401);

  if (request.method === 'GET') {
    const row = await ensureSettings(env.DB, user.id);
    return json(request, {
      settings: {
        notifyTime: row?.notify_time || DEFAULT_TIME,
        enabled: row?.enabled !== 0
      }
    });
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
    const notifyTime = String(body?.notifyTime || '');
    if (!validTime(notifyTime)) return json(request, { error: '通知時刻が不正です' }, 400);
    const enabled = body?.enabled === false ? 0 : 1;
    await env.DB.prepare(
      `INSERT INTO monthly_summary_notification_settings(user_id,notify_time,enabled,updated_at)
       VALUES(?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         notify_time=excluded.notify_time,
         enabled=excluded.enabled,
         updated_at=excluded.updated_at`
    ).bind(user.id, notifyTime, enabled, Date.now()).run();
    return json(request, { ok: true, settings: { notifyTime, enabled: Boolean(enabled) } });
  }

  return json(request, { error: 'not found' }, 404);
}

function jstNow(epoch = Date.now()) {
  const shifted = new Date(epoch + 9 * 60 * 60 * 1000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  };
}

function previousMonthKey(dateString) {
  const [year, month] = String(dateString).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function expenseParts(row) {
  let parts = [];
  try {
    const parsed = JSON.parse(row.installments_json || 'null');
    if (Array.isArray(parsed)) {
      parts = parsed.map((part) => ({
        date: String(part?.date || ''),
        amount: Math.round(Number(part?.amount || 0))
      })).filter((part) => /^\d{4}-\d{2}-\d{2}$/.test(part.date) && part.amount > 0);
    }
  } catch {}
  if (!parts.length) parts = [{ date: String(row.date || ''), amount: Math.round(Number(row.amount || 0)) }];
  return parts;
}

function yen(value) {
  return `¥${Math.round(Number(value || 0)).toLocaleString('ja-JP')}`;
}

async function publicKey(db) {
  const row = await db.prepare("SELECT value FROM system_config WHERE key='vapid_public_key'").first();
  return row?.value || null;
}

async function sendPush(env, userId, message, vapidPublicKey) {
  if (!env.VAPID_PRIVATE_KEY || !vapidPublicKey) return false;
  const result = await env.DB.prepare(
    'SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?'
  ).bind(userId).all();
  const subscriptions = result.results || [];
  if (!subscriptions.length) return false;

  const vapid = {
    subject: 'https://teto-paymo.pages.dev',
    publicKey: vapidPublicKey,
    privateKey: env.VAPID_PRIVATE_KEY
  };

  let delivered = false;
  for (const sub of subscriptions) {
    try {
      const payload = await buildPushPayload(
        { data: JSON.stringify(message), options: { ttl: 3600 } },
        { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        vapid
      );
      const response = await fetch(sub.endpoint, payload);
      if (response.ok) delivered = true;
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(sub.endpoint).run();
      }
    } catch (error) {
      console.error('Paymo monthly summary push delivery error', error);
    }
  }
  return delivered;
}

export async function runMonthlySummaryNotificationSchedule(env) {
  if (!env.DB || !env.VAPID_PRIVATE_KEY) return;
  const now = jstNow();
  if (!now.date.endsWith('-01')) return;

  const vapidPublicKey = await publicKey(env.DB);
  if (!vapidPublicKey) return;

  const monthKey = previousMonthKey(now.date);
  const monthLabel = `${Number(monthKey.slice(5, 7))}月`;
  const settingsResult = await env.DB.prepare(
    'SELECT user_id,notify_time,enabled FROM monthly_summary_notification_settings WHERE enabled=1'
  ).all();

  for (const setting of settingsResult.results || []) {
    const notifyTime = validTime(setting.notify_time) ? setting.notify_time : DEFAULT_TIME;
    if (now.minutes < toMinutes(notifyTime)) continue;

    const sent = await env.DB.prepare(
      'SELECT 1 FROM monthly_summary_notification_deliveries WHERE user_id=? AND month_key=?'
    ).bind(setting.user_id, monthKey).first();
    if (sent) continue;

    const expenseResult = await env.DB.prepare(
      'SELECT id,payee,amount,date,installments_json FROM expenses WHERE owner_key=?'
    ).bind(setting.user_id).all();

    let total = 0;
    for (const expense of expenseResult.results || []) {
      for (const part of expenseParts(expense)) {
        if (part.date.slice(0, 7) === monthKey) total += part.amount;
      }
    }

    const pushed = await sendPush(env, setting.user_id, {
      title: '前月の支払い額が確定しました',
      body: `${monthLabel}の支払い額　${yen(total)}`,
      tag: `paymo-monthly-summary-${monthKey}`,
      url: '/'
    }, vapidPublicKey);
    if (!pushed) continue;

    await env.DB.prepare(
      `INSERT OR IGNORE INTO monthly_summary_notification_deliveries(user_id,month_key,sent_at)
       VALUES(?,?,?)`
    ).bind(setting.user_id, monthKey, Date.now()).run();
  }
}
