import { buildPushPayload } from '@block65/webcrypto-web-push';

const encoder = new TextEncoder();
const ALLOWED_ORIGIN = 'https://teto-paymo.pages.dev';
const DEFAULT_TIMES = {
  sameDayTime: '09:00',
  oneDayTime: '09:00',
  twoDaysTime: '09:00'
};

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
    `INSERT OR IGNORE INTO payment_notification_settings
      (user_id,one_day_time,same_day_time,enabled,updated_at)
     VALUES(?,?,?,1,?)`
  ).bind(userId, DEFAULT_TIMES.oneDayTime, DEFAULT_TIMES.sameDayTime, Date.now()).run();
  return db.prepare(
    `SELECT two_days_time,one_day_time,same_day_time,
            two_days_enabled,one_day_enabled,same_day_enabled,enabled
     FROM payment_notification_settings WHERE user_id=?`
  ).bind(userId).first();
}

async function publicKey(db) {
  const row = await db.prepare("SELECT value FROM system_config WHERE key='vapid_public_key'").first();
  return row?.value || null;
}

export async function handleNotificationFetch(request, env, url) {
  const paths = new Set([
    '/api/push/public-key',
    '/api/push/subscriptions',
    '/api/notification-settings'
  ]);
  if (!paths.has(url.pathname)) return null;
  if (!env.DB) return json(request, { error: 'D1 binding DB is not configured' }, 503);

  const user = await getUser(request, env.DB);
  if (!user?.id) return json(request, { error: '未ログインです' }, 401);

  if (url.pathname === '/api/push/public-key' && request.method === 'GET') {
    return json(request, { publicKey: await publicKey(env.DB) });
  }

  if (url.pathname === '/api/push/subscriptions' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return json(request, { error: '購読情報が不正です' }, 400);
    }
    await env.DB.prepare(
      `INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,created_at)
       VALUES(?,?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth`
    ).bind(crypto.randomUUID(), user.id, String(sub.endpoint), String(sub.keys.p256dh), String(sub.keys.auth), Date.now()).run();
    await ensureSettings(env.DB, user.id);
    return json(request, { ok: true });
  }

  if (url.pathname === '/api/push/subscriptions' && request.method === 'DELETE') {
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const endpoint = String(body?.endpoint || '');
    if (!endpoint) return json(request, { error: 'endpointが必要です' }, 400);
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').bind(user.id, endpoint).run();
    return json(request, { ok: true });
  }

  if (url.pathname === '/api/notification-settings' && request.method === 'GET') {
    const row = await ensureSettings(env.DB, user.id);
    return json(request, {
      settings: {
        sameDayTime: row?.same_day_time || DEFAULT_TIMES.sameDayTime,
        oneDayTime: row?.one_day_time || DEFAULT_TIMES.oneDayTime,
        twoDaysTime: row?.two_days_time || DEFAULT_TIMES.twoDaysTime,
        sameDayEnabled: row?.same_day_enabled !== 0,
        oneDayEnabled: row?.one_day_enabled !== 0,
        twoDaysEnabled: row?.two_days_enabled !== 0
      }
    });
  }

  if (url.pathname === '/api/notification-settings' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json(request, { error: 'invalid json' }, 400); }
    const sameDayTime = String(body?.sameDayTime || '');
    const oneDayTime = String(body?.oneDayTime || '');
    const twoDaysTime = String(body?.twoDaysTime || '');
    if (![sameDayTime, oneDayTime, twoDaysTime].every(validTime)) {
      return json(request, { error: '通知時刻が不正です' }, 400);
    }
    const sameDayEnabled = body?.sameDayEnabled === false ? 0 : 1;
    const oneDayEnabled = body?.oneDayEnabled === false ? 0 : 1;
    const twoDaysEnabled = body?.twoDaysEnabled === false ? 0 : 1;
    await env.DB.prepare(
      `INSERT INTO payment_notification_settings
        (user_id,two_days_time,one_day_time,same_day_time,two_days_enabled,one_day_enabled,same_day_enabled,enabled,updated_at)
       VALUES(?,?,?,?,?,?,?,1,?)
       ON CONFLICT(user_id) DO UPDATE SET
         two_days_time=excluded.two_days_time,
         one_day_time=excluded.one_day_time,
         same_day_time=excluded.same_day_time,
         two_days_enabled=excluded.two_days_enabled,
         one_day_enabled=excluded.one_day_enabled,
         same_day_enabled=excluded.same_day_enabled,
         enabled=1,
         updated_at=excluded.updated_at`
    ).bind(
      user.id,
      twoDaysTime,
      oneDayTime,
      sameDayTime,
      twoDaysEnabled,
      oneDayEnabled,
      sameDayEnabled,
      Date.now()
    ).run();
    return json(request, {
      ok: true,
      settings: {
        sameDayTime,
        oneDayTime,
        twoDaysTime,
        sameDayEnabled: Boolean(sameDayEnabled),
        oneDayEnabled: Boolean(oneDayEnabled),
        twoDaysEnabled: Boolean(twoDaysEnabled)
      }
    });
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

function addDays(dateString, days) {
  const [y, m, d] = String(dateString).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function expenseParts(row) {
  let parts = [];
  try {
    const parsed = JSON.parse(row.installments_json || 'null');
    if (Array.isArray(parsed)) {
      parts = parsed.map((part, index) => ({
        index,
        date: String(part?.date || ''),
        amount: Math.round(Number(part?.amount || 0))
      })).filter((part) => /^\d{4}-\d{2}-\d{2}$/.test(part.date) && part.amount > 0);
    }
  } catch {}
  if (!parts.length) parts = [{ index: 0, date: String(row.date || ''), amount: Math.round(Number(row.amount || 0)) }];
  return parts;
}

function yen(value) {
  return `¥${Math.round(Number(value || 0)).toLocaleString('ja-JP')}`;
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
      console.error('Paymo push delivery error', error);
    }
  }
  return delivered;
}

function titleFor(daysBefore) {
  if (daysBefore === 2) return '支払期日の2日前です';
  if (daysBefore === 1) return '支払期日は明日です';
  return '支払期日当日です';
}

export async function runPaymentNotificationSchedule(env) {
  if (!env.DB || !env.VAPID_PRIVATE_KEY) return;
  const vapidPublicKey = await publicKey(env.DB);
  if (!vapidPublicKey) return;

  const now = jstNow();
  const settingsResult = await env.DB.prepare(
    `SELECT user_id,two_days_time,one_day_time,same_day_time,
            two_days_enabled,one_day_enabled,same_day_enabled
     FROM payment_notification_settings WHERE enabled=1`
  ).all();

  for (const setting of settingsResult.results || []) {
    const expenseResult = await env.DB.prepare(
      `SELECT e.id,e.payee,e.amount,e.date,e.installments_json
       FROM expenses e
       LEFT JOIN expense_status s ON s.owner_key=e.owner_key AND s.id=e.id
       WHERE e.owner_key=? AND COALESCE(s.paid,0)=0`
    ).bind(setting.user_id).all();
    const expenses = expenseResult.results || [];

    const schedules = [
      { daysBefore: 0, time: setting.same_day_time || DEFAULT_TIMES.sameDayTime, enabled: setting.same_day_enabled !== 0 },
      { daysBefore: 1, time: setting.one_day_time || DEFAULT_TIMES.oneDayTime, enabled: setting.one_day_enabled !== 0 },
      { daysBefore: 2, time: setting.two_days_time || DEFAULT_TIMES.twoDaysTime, enabled: setting.two_days_enabled !== 0 }
    ];

    for (const schedule of schedules) {
      if (!schedule.enabled || !validTime(schedule.time) || now.minutes < toMinutes(schedule.time)) continue;
      const dueDate = addDays(now.date, schedule.daysBefore);
      const deliveredResult = await env.DB.prepare(
        'SELECT expense_id,installment_index FROM payment_notification_deliveries WHERE user_id=? AND due_date=? AND days_before=?'
      ).bind(setting.user_id, dueDate, schedule.daysBefore).all();
      const delivered = new Set((deliveredResult.results || []).map((row) => `${row.expense_id}:${row.installment_index}`));
      const due = [];

      for (const expense of expenses) {
        for (const part of expenseParts(expense)) {
          const key = `${expense.id}:${part.index}`;
          if (part.date === dueDate && !delivered.has(key)) {
            due.push({ expenseId: expense.id, installmentIndex: part.index, payee: expense.payee, amount: part.amount });
          }
        }
      }
      if (!due.length) continue;

      const total = due.reduce((sum, item) => sum + item.amount, 0);
      const body = due.length === 1
        ? `${due[0].payee}　${yen(due[0].amount)}`
        : `${due.length}件　合計 ${yen(total)}`;
      const pushed = await sendPush(env, setting.user_id, {
        title: titleFor(schedule.daysBefore),
        body,
        tag: `paymo-payment-${dueDate}-${schedule.daysBefore}`,
        url: '/'
      }, vapidPublicKey);
      if (!pushed) continue;

      const sentAt = Date.now();
      await env.DB.batch(due.map((item) => env.DB.prepare(
        `INSERT OR IGNORE INTO payment_notification_deliveries
          (id,user_id,expense_id,installment_index,due_date,days_before,sent_at)
         VALUES(?,?,?,?,?,?,?)`
      ).bind(crypto.randomUUID(), setting.user_id, item.expenseId, item.installmentIndex, dueDate, schedule.daysBefore, sentAt)));
    }
  }
}
