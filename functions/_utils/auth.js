const encoder = new TextEncoder();

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

const b64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replaceAll('=', '');

const randomBytes = (size) => crypto.getRandomValues(new Uint8Array(size));

export async function sha(value) {
  return b64(await crypto.subtle.digest('SHA-256', encoder.encode(String(value || ''))));
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: encoder.encode(salt),
    iterations: 100000,
    hash: 'SHA-256'
  }, key, 256));
}

export async function ensureAuthSchema(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login_id TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS recovery_codes (code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, used_at INTEGER, created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, blocked_until INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS account_settings (user_id TEXT NOT NULL, setting_key TEXT NOT NULL, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, setting_key))'),
    db.prepare('CREATE TABLE IF NOT EXISTS expense_status (owner_key TEXT NOT NULL, id TEXT NOT NULL, paid INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner_key, id))'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id)')
  ]);
}

export async function createSession(db, userId) {
  const raw = b64(randomBytes(32));
  const tokenHash = await sha(raw);
  const now = Date.now();
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .bind(tokenHash, userId, now + 2592000000, now).run();
  return raw;
}

export async function getUser(request, db) {
  await ensureAuthSchema(db);
  const raw = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!raw) return null;
  const now = Date.now();
  const tokenHash = await sha(raw);
  const user = await db.prepare(
    'SELECT u.id,u.login_id,u.nickname,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(tokenHash, now).first();
  if (!user) await db.prepare('DELETE FROM sessions WHERE token_hash=? AND expires_at<=?').bind(tokenHash, now).run();
  return user || null;
}

const recoveryAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const recoveryCode = () => Array.from(randomBytes(12), (value) => recoveryAlphabet[value % recoveryAlphabet.length]).join('');

export async function createRecoveryCode(db, userId) {
  await db.prepare('DELETE FROM recovery_codes WHERE user_id=?').bind(userId).run();
  const code = recoveryCode();
  await db.prepare('INSERT INTO recovery_codes(code_hash,user_id,used_at,created_at) VALUES(?,?,NULL,?)')
    .bind(await sha(code), userId, Date.now()).run();
  return code;
}

export function normalizePayees(value) {
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

export async function saveSetting(db, userId, key, value) {
  await db.prepare(
    'INSERT INTO account_settings(user_id,setting_key,value_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,setting_key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at'
  ).bind(userId, key, JSON.stringify(value), Date.now()).run();
}

export async function readSetting(db, userId, key) {
  const row = await db.prepare('SELECT value_json FROM account_settings WHERE user_id=? AND setting_key=?').bind(userId, key).first();
  if (!row?.value_json) return null;
  try { return JSON.parse(row.value_json); } catch { return null; }
}

export function validLegacyKey(value) {
  return /^[A-Za-z0-9_-]{24,128}$/.test(String(value || ''));
}
