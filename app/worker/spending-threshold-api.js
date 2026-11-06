import { publicKey, sendPush } from './notification-api.js';

const encoder = new TextEncoder();
const DELAY_MS = 10 * 60 * 1000;
const DEFAULT_THRESHOLD = 30000;
const MAX_THRESHOLD = 1_000_000_000_000;

function json(request, data, status = 200) {
  const origin = request.headers.get('origin') || '';
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-paymo-spending-threshold-api': '1',
      'access-control-allow-origin': origin === 'https://teto-paymo.pages.dev' ? origin : 'https://teto-paymo.pages.dev',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
      'vary': 'Origin'
    }
  });
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function authenticatedUserId(request, db) {
  const raw = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!raw) return null;
  const tokenHash = base64url(await crypto.subtle.digest('SHA-256', encoder.encode(raw)));
  const user = await db.prepare(
    'SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(tokenHash, Date.now()).first();
  return user?.id || null;
}

function monthInJst(now = Date.now()) {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function firstDayNextMonth(month) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
}

async function monthTotal(db, userId, month) {
  const row = await db.prepare(
    'SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE owner_key=? AND COALESCE(usage_date,date)>=? AND COALESCE(usage_date,date)<?'
  ).bind(userId, month + '-01', firstDayNextMonth(month)).first();
  return Number(row?.total || 0);
}

async function thresholdSettings(db, userId) {
  await db.prepare(
    'INSERT OR IGNORE INTO spending_threshold_settings (user_id,threshold_amount,enabled,updated_at) VALUES (?,?,1,?)'
  ).bind(userId, DEFAULT_THRESHOLD, Date.now()).run();
  return db.prepare(
    'SELECT threshold_amount,enabled FROM spending_threshold_settings WHERE user_id=?'
  ).bind(userId).first();
}

// Called after an expense mutation, after changing the limit, and by the scheduled job.
// An unsent crossing is cancelled if the total falls back to the limit or below.
// A delivered crossing is retained so the same month never sends twice.
async function reconcile(db, userId, now = Date.now()) {
  const month = monthInJst(now);
  const settings = await thresholdSettings(db, userId);
  const threshold = Number(settings?.threshold_amount || 0);
  const enabled = settings?.enabled === 1 && threshold > 0;
  const existing = await db.prepare(
    'SELECT threshold_amount,crossed_at,sent_at FROM spending_threshold_events WHERE user_id=? AND month_key=?'
  ).bind(userId, month).first();

  if (!enabled) {
    await db.prepare(
      'DELETE FROM spending_threshold_events WHERE user_id=? AND month_key=? AND sent_at IS NULL'
    ).bind(userId, month).run();
    return;
  }

  const total = await monthTotal(db, userId, month);
  if (total <= threshold) {
    await db.prepare(
      'DELETE FROM spending_threshold_events WHERE user_id=? AND month_key=? AND sent_at IS NULL'
    ).bind(userId, month).run();
    return;
  }

  if (existing?.sent_at != null) return;
  if (!existing) {
    await db.prepare(
      'INSERT OR IGNORE INTO spending_threshold_events (user_id,month_key,threshold_amount,crossed_at,sending_at,sent_at) VALUES (?,?,?,?,NULL,NULL)'
    ).bind(userId, month, threshold, now).run();
  } else if (Number(existing.threshold_amount) !== threshold) {
    await db.prepare(
      'UPDATE spending_threshold_events SET threshold_amount=?,crossed_at=?,sending_at=NULL WHERE user_id=? AND month_key=? AND sent_at IS NULL'
    ).bind(threshold, now, userId, month).run();
  }
}

export async function handleSpendingThresholdFetch(request, env, url) {
  if (url.pathname !== '/api/spending-threshold-settings') return null;
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': 'https://teto-paymo.pages.dev',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-max-age': '86400',
      'x-paymo-spending-threshold-api': '1'
    }
  });
  if (!env.DB) return json(request, { error: 'D1 binding DB is not configured' }, 503);
  const userId = await authenticatedUserId(request, env.DB);
  if (!userId) return json(request, { error: '未ログインです' }, 401);

  if (request.method === 'GET') {
    const settings = await thresholdSettings(env.DB, userId);
    return json(request, {
      settings: {
        enabled: settings?.enabled === 1,
        threshold: Number(settings?.threshold_amount || 0),
        delayMinutes: 10,
        basis: 'monthly_usage'
      }
    });
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); }
    catch { return json(request, { error: '入力内容が不正です' }, 400); }

    const threshold = Number(body?.threshold);
    const enabled = body?.enabled === true;
    if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > MAX_THRESHOLD ||
        (enabled && threshold === 0)) {
      return json(request, { error: '1円以上の通知金額を設定してください' }, 400);
    }

    await env.DB.prepare(
      'INSERT INTO spending_threshold_settings (user_id,threshold_amount,enabled,updated_at) VALUES (?,?,?,?) ' +
      'ON CONFLICT(user_id) DO UPDATE SET threshold_amount=excluded.threshold_amount,enabled=excluded.enabled,updated_at=excluded.updated_at'
    ).bind(userId, threshold, enabled ? 1 : 0, Date.now()).run();
    await reconcile(env.DB, userId);
    return json(request, { ok: true, settings: { threshold, enabled, delayMinutes: 10, basis: 'monthly_usage' } });
  }
  return json(request, { error: 'not found' }, 404);
}

export async function reconcileSpendingAfterExpenseMutation(request, env) {
  if (!env.DB) return;
  const userId = await authenticatedUserId(request, env.DB);
  if (userId) await reconcile(env.DB, userId);
}

export async function runSpendingThresholdSchedule(env) {
  if (!env.DB || !env.VAPID_PRIVATE_KEY) return;
  const key = await publicKey(env.DB);
  if (!key) return;
  const now = Date.now();
  const month = monthInJst(now);

  const users = await env.DB.prepare(
    'SELECT user_id FROM spending_threshold_settings WHERE enabled=1 AND threshold_amount>0'
  ).all();
  for (const user of users.results || []) {
    try { await reconcile(env.DB, user.user_id, now); }
    catch (error) { console.error('Paymo spending threshold reconciliation error', error); }
  }

  const due = await env.DB.prepare(
    'SELECT e.user_id,e.threshold_amount,e.crossed_at FROM spending_threshold_events e ' +
    'JOIN spending_threshold_settings s ON s.user_id=e.user_id ' +
    'WHERE e.month_key=? AND e.sent_at IS NULL AND e.crossed_at<=? AND ' +
    's.enabled=1 AND s.threshold_amount=e.threshold_amount'
  ).bind(month, now - DELAY_MS).all();

  for (const event of due.results || []) {
    try {
      // Lease the delivery so overlapping cron runs cannot push the same notification.
      const claim = await env.DB.prepare(
        'UPDATE spending_threshold_events SET sending_at=? WHERE user_id=? AND month_key=? ' +
        'AND crossed_at=? AND sent_at IS NULL AND (sending_at IS NULL OR sending_at<?)'
      ).bind(now, event.user_id, month, event.crossed_at, now - 5 * 60 * 1000).run();
      if (Number(claim.meta?.changes || 0) !== 1) continue;

      const currentTotal = await monthTotal(env.DB, event.user_id, month);
      if (currentTotal <= Number(event.threshold_amount)) {
        await env.DB.prepare(
          'DELETE FROM spending_threshold_events WHERE user_id=? AND month_key=? AND sent_at IS NULL'
        ).bind(event.user_id, month).run();
        continue;
      }

      const pushed = await sendPush(env, event.user_id, {
        title: '支出額が設定金額を超えました',
        body: '今月の支出 ' + yen(currentTotal) + '（設定 ' + yen(event.threshold_amount) + '）',
        tag: 'paymo-spending-threshold-' + month,
        url: '/'
      }, key);

      if (pushed) {
        await env.DB.prepare(
          'UPDATE spending_threshold_events SET sent_at=?,sending_at=NULL WHERE user_id=? AND month_key=? AND sent_at IS NULL'
        ).bind(Date.now(), event.user_id, month).run();
      } else {
        await env.DB.prepare(
          'UPDATE spending_threshold_events SET sending_at=NULL WHERE user_id=? AND month_key=? AND sent_at IS NULL'
        ).bind(event.user_id, month).run();
      }
    } catch (error) {
      console.error('Paymo spending threshold push error', error);
      await env.DB.prepare(
        'UPDATE spending_threshold_events SET sending_at=NULL WHERE user_id=? AND month_key=? AND sent_at IS NULL'
      ).bind(event.user_id, month).run().catch(() => {});
    }
  }
}

function yen(amount) {
  return '¥' + Math.round(Number(amount || 0)).toLocaleString('ja-JP');
}
