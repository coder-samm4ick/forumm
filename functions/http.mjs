// Общие HTTP-инструменты Function'а: стабильные ошибки, bounded JSON, проверка источника, разбор пути.
// Приложение не использует платформу как источник идентичности игрока: только собственные сессии из БД.

// Фиксированный публичный источник сайта. APP_ORIGIN из настроек сайта имеет приоритет,
// иначе берётся это значение — список через запятую, чтобы потом добавить свой домен одной строкой.
export const FALLBACK_ORIGINS = 'https://premaze-forum-m2ds0hqr30a.qoder.website';

export const BODY_LIMIT_BYTES = 32768;

export class AppError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

const NO_STORE = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' };

export function json(value, status = 200, extra = {}) {
  return Response.json(value, { status, headers: { ...NO_STORE, ...extra } });
}

export function errorJson(code, status, extra = {}) {
  return json({ error: code }, status, extra);
}

// Шлюз заменяет сегмент `app` физическим именем деплоя, а провайдер может срезать /functions/v1.
export function applicationPath(request) {
  const match = new URL(request.url).pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
  if (!match) throw new AppError('not_found', 404);
  return match[1] || '/';
}

export function trustedOrigins(configured) {
  const raw = (typeof configured === 'string' && configured.trim()) || FALLBACK_ORIGINS;
  const list = raw.split(',').map((value) => value.trim()).filter(Boolean);
  for (const value of list) {
    let url;
    try { url = new URL(value); } catch { throw new AppError('origin_not_configured', 503); }
    if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, '')) {
      throw new AppError('origin_not_configured', 503);
    }
  }
  if (list.length === 0) throw new AppError('origin_not_configured', 503);
  return list;
}

// Second CSRF line behind SameSite=Lax cookies: unsafe methods must come from a known site origin.
export function requireTrustedOrigin(request, configured) {
  const allowed = trustedOrigins(configured);
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (!allowed.includes(request.headers.get('origin') ?? '')) throw new AppError('origin_forbidden', 403);
}

// Лимит считается по фактически прочитанным байтам, Content-Length не принимается на веру.
export async function readJson(request, maxBytes = BODY_LIMIT_BYTES) {
  const type = request.headers.get('content-type')?.split(';')[0].trim();
  if (type !== 'application/json') throw new AppError('invalid_input', 400);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('invalid_input', 400);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError('payload_too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new AppError('invalid_input', 400);
  }
}

export function rows(result) {
  if (result?.error || !Array.isArray(result?.data)) throw new AppError('database_unavailable', 503);
  return result.data;
}

export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

export function intParam(request, name, fallback, max) {
  const raw = new URL(request.url).searchParams.get(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new AppError('invalid_input', 400);
  return value;
}
