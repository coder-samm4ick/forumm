// Идентичность форума: ник/пароль, сессии, роли и анти-флуд. Всё живёт в БД сайта,
// платформа (Qoder-аккаунт игрока) в авторизации не участвует.
import { AppError, rows } from './http.mjs';

export const ROLES = { guest: 0, member: 1, helper: 2, admin: 3, dev: 4 };

export function roleAtLeast(role, need) {
  return (ROLES[role] ?? 0) >= (ROLES[need] ?? 0);
}

export function canRead(role, forum) {
  return roleAtLeast(role ?? 'guest', forum.read_role);
}

export function canWrite(role, forum) {
  return roleAtLeast(role ?? 'guest', forum.write_role);
}

// ── ник и пароль ────────────────────────────────────────────────────────────

const USERNAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.'-]{1,23}[\p{L}\p{N}.'-]$/u;

// Уникальность по каноническому виду (нижний регистр, схлопнутые пробелы),
// а игроку показывается тот вариант, который он набрал при регистрации.
export function canonicalUsername(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_username', 400);
  const spaced = raw.trim().replace(/\s+/g, ' ');
  const username = spaced.toLowerCase();
  if (!USERNAME_RE.test(spaced) || spaced.includes('..')) throw new AppError('invalid_username', 400);
  return username;
}

export function displayName(raw) {
  const spaced = raw.trim().replace(/\s+/g, ' ');
  if (!USERNAME_RE.test(spaced)) throw new AppError('invalid_username', 400);
  return spaced.slice(0, 24);
}

export function validatePassword(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length < 8) throw new AppError('weak_password', 400);
  if (new TextEncoder().encode(raw).length > 256) throw new AppError('weak_password', 400);
  return raw;
}

// ── PBKDF2 ──────────────────────────────────────────────────────────────────

export const PBKDF2_ITERATIONS = 300000;
const KEY_BITS = 256;
const SALT_BYTES = 16;
const encoder = new TextEncoder();

// Неизвестный ник тоже должен стоить вычислений: иначе по времени ответа
// можно перебирать список существующих аккаунтов.
const DUMMY_SALT = new Uint8Array(SALT_BYTES);
const DUMMY_EXPECTED = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derive(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, KEY_BITS);
  return new Uint8Array(bits);
}

export function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return { salt: toBase64(salt), hash: toBase64(await derive(password, salt, iterations)), iterations };
}

export async function verifyPassword(password, record) {
  if (typeof record?.salt !== 'string' || typeof record?.hash !== 'string') return false;
  const iterations = Number.isSafeInteger(record.iterations) ? record.iterations : PBKDF2_ITERATIONS;
  let salt;
  try { salt = fromBase64(record.salt); } catch { return false; }
  return timingSafeEqual(toBase64(await derive(password, salt, iterations)), record.hash);
}

export async function verifyPasswordAgainstDummy(password) {
  return timingSafeEqual(toBase64(await derive(password, DUMMY_SALT, PBKDF2_ITERATIONS)), DUMMY_EXPECTED);
}

// ── сессии ──────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = '__Host-pmf.session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;
const MAX_COOKIE_HEADER = 8192;

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function newSessionToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function sessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function sessionTokenFrom(request) {
  const header = request.headers.get('cookie') ?? '';
  if (!header) return null;
  if (header.length > MAX_COOKIE_HEADER) throw new AppError('invalid_credentials', 400);
  const values = [];
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const at = trimmed.indexOf('=');
    if (at < 1) continue;
    if (trimmed.slice(0, at).trim() === SESSION_COOKIE) values.push(trimmed.slice(at + 1));
  }
  if (values.length === 0) return null;
  if (values.length > 1) throw new AppError('invalid_credentials', 400);
  if (!/^[A-Za-z0-9_-]{43}$/.test(values[0])) throw new AppError('invalid_credentials', 400);
  return values[0];
}

export async function createSession(db, userId, now = Date.now()) {
  const token = newSessionToken();
  const digest = await sha256Hex(token);
  const created = rows(await db.from('sessions').insertIfAbsent({
    token_digest: digest,
    user_id: userId,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_TTL_MS).toISOString(),
  }, { onConflict: 'token_digest' }).select('token_digest'));
  if (created.length !== 1) throw new AppError('session_unavailable', 503);
  return { token, digest };
}

export async function validateSession(db, request, now = Date.now()) {
  const token = sessionTokenFrom(request);
  if (!token) return { state: 'missing', session: null };
  const digest = await sha256Hex(token);
  const found = rows(await db.from('sessions')
    .select('token_digest,user_id,expires_at,revoked_at').eq('token_digest', digest).limit(1));
  if (found.length !== 1) return { state: 'invalid', session: null };
  const row = found[0];
  if (row.revoked_at != null) return { state: 'invalid', session: null };
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return { state: 'invalid', session: null };
  return { state: 'valid', session: { digest, userId: row.user_id } };
}

export async function revokeSession(db, digest, now = Date.now()) {
  const revoked = rows(await db.from('sessions')
    .update({ revoked_at: new Date(now).toISOString() }).eq('token_digest', digest).select('token_digest'));
  return revoked.length === 1;
}

// ── лимитер: брутфорс входа и флуд постов ───────────────────────────────────

export const LIMITS = {
  login: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  register: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },
  topic: { maxAttempts: 8, windowMs: 30 * 60 * 1000 },
  reply: { maxAttempts: 20, windowMs: 10 * 60 * 1000 },
};

const MAX_CAS_ATTEMPTS = 24;
const iso = (ms) => new Date(ms).toISOString();

async function readBucket(db, key) {
  return rows(await db.from('auth_limiter')
    .select('key,window_started_at,attempt_count').eq('key', key).limit(1));
}

// Ключ — скоуп + ник (до входа) или id аккаунта (после входа).
// Счётчик живёт в БД и обновляется как CAS: предикатом служат наблюдаемые
// окно и счётчик, поэтому параллельные запросы не затирают друг друга.
export async function consume(db, scope, principal, now = Date.now()) {
  const limit = LIMITS[scope];
  if (!limit) throw new AppError('limiter_unavailable', 503);
  const key = `${scope}:${principal}`;

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const found = await readBucket(db, key);

    if (found.length === 0) {
      const inserted = rows(await db.from('auth_limiter').insertIfAbsent({
        key, window_started_at: iso(now), attempt_count: 1,
      }, { onConflict: 'key' }).select('key'));
      if (inserted.length === 1) return { allowed: true };
      continue;
    }

    const row = found[0];
    const startedAt = Date.parse(row.window_started_at);
    const count = row.attempt_count;
    if (typeof row.window_started_at !== 'string' || !Number.isSafeInteger(count) || count < 0) {
      throw new AppError('limiter_unavailable', 503);
    }

    if (!Number.isFinite(startedAt) || now - startedAt >= limit.windowMs) {
      const reset = rows(await db.from('auth_limiter')
        .update({ window_started_at: iso(now), attempt_count: 1 })
        .eq('key', key).eq('window_started_at', row.window_started_at).select('key'));
      if (reset.length === 1) return { allowed: true };
      continue;
    }

    if (count >= limit.maxAttempts) {
      return { allowed: false, retryAfterMs: Math.max(0, startedAt + limit.windowMs - now) };
    }

    const incremented = rows(await db.from('auth_limiter')
      .update({ attempt_count: count + 1 })
      .eq('key', key).eq('window_started_at', row.window_started_at).eq('attempt_count', count)
      .select('key'));
    if (incremented.length === 1) return { allowed: true };
  }

  throw new AppError('limiter_busy', 503);
}
