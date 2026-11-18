// Бизнес-маршруты форума. Никакой платформы в авторизации: идентичность игрока —
// только собственная сессия из БД (http.mjs / security.mjs), роли проверяются здесь.
import {
  AppError, applicationPath, errorJson, intParam, isUuid, json, readJson,
  requireTrustedOrigin, rows,
} from './http.mjs';
import {
  LIMITS, SESSION_TTL_MS, canRead, canWrite, canonicalUsername, consume, createSession, displayName,
  hashPassword, roleAtLeast, sessionCookie, validatePassword, validateSession,
  verifyPassword, verifyPasswordAgainstDummy, clearSessionCookie,
} from './security.mjs';
import { ensureStructure, stableUuid } from './content.mjs';

export const TOPICS_PER_PAGE = 20;
export const POSTS_PER_PAGE = 15;
export const LATEST_PER_PAGE = 25;
export const SEARCH_SCAN_TOPICS = 300;
export const PREVIEW_SCAN_TOPICS = 200;
export const MAX_TITLE_CHARS = 120;
export const MAX_BODY_CHARS = 6000;

const MAX_CAS_ATTEMPTS = 16;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const iso = (ms) => new Date(ms).toISOString();

function text(value, max, code = 'invalid_input') {
  if (typeof value !== 'string') throw new AppError(code, 400);
  const normalized = value.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '').trim();
  if (normalized.length === 0 || [...normalized].length > max) throw new AppError(code, 400);
  return normalized;
}

function publicUser(user) {
  return { id: user.id, username: user.display_name, role: user.role };
}

function requireRole(user, need) {
  if (!roleAtLeast(user.role, need)) throw new AppError('forbidden', 403);
}

export function application(deps) {
  const { db, env = () => undefined, now = Date.now } = deps;

  // ── чтение дерева разделов ────────────────────────────────────────────────

  async function loadCategories() {
    return rows(await db.from('categories')
      .select('id,slug,title,sort_order,read_role').order('sort_order').limit(64));
  }

  async function loadForums() {
    return rows(await db.from('forums')
      .select('id,category_id,slug,title,description,sort_order,read_role,write_role,prefixes,external_url,topic_count,post_count,last_topic_id,last_post_at')
      .order('sort_order')
      .limit(256));
  }

  function forumVisible(role, forum, categories) {
    const category = categories.get(forum.category_id);
    if (!category) return false;
    return canRead(role, { read_role: forum.read_role }) && canRead(role, { read_role: category.read_role });
  }

  function shapeForum(forum) {
    const prefixes = Array.isArray(forum.prefixes) ? forum.prefixes.filter((item) => typeof item === 'string') : [];
    return {
      id: forum.id,
      slug: forum.slug,
      title: forum.title,
      description: forum.description,
      read_role: forum.read_role,
      write_role: forum.write_role,
      prefixes,
      external_url: forum.external_url ?? null,
      topic_count: Number.isSafeInteger(forum.topic_count) ? forum.topic_count : 0,
      post_count: Number.isSafeInteger(forum.post_count) ? forum.post_count : 0,
      last_topic_id: forum.last_topic_id ?? null,
      last_post_at: forum.last_post_at ?? null,
    };
  }

  // Превью последней темы для каждого раздела одним запросом вместо N:
  // берём свежие темы и оставляем первую на раздел.
  async function latestPreview() {
    const found = rows(await db.from('topics')
      .select('id,forum_id,title,prefix,last_post_at,last_poster_name,reply_count,is_deleted')
      .order('last_post_at', { ascending: false })
      .limit(PREVIEW_SCAN_TOPICS));
    const byForum = new Map();
    for (const topic of found) {
      if (topic.is_deleted === true || byForum.has(topic.forum_id)) continue;
      byForum.set(topic.forum_id, {
        id: topic.id, title: topic.title, prefix: topic.prefix ?? '',
        last_post_at: topic.last_post_at, last_poster_name: topic.last_poster_name,
        reply_count: Number.isSafeInteger(topic.reply_count) ? topic.reply_count : 0,
      });
    }
    return byForum;
  }

  // ── счётчики (CAS: предикат — старые значения счётчиков) ──────────────────

  async function bumpForum(forumId, deltaTopics, deltaPosts, lastTopicId, lastPostAt) {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const found = rows(await db.from('forums')
        .select('id,topic_count,post_count').eq('id', forumId).limit(1));
      if (found.length !== 1) throw new AppError('not_found', 404);
      const forum = found[0];
      if (!Number.isSafeInteger(forum.topic_count) || !Number.isSafeInteger(forum.post_count)) {
        throw new AppError('counter_unavailable', 503);
      }
      const topicCount = forum.topic_count + deltaTopics;
      const postCount = forum.post_count + deltaPosts;
      const updated = rows(await db.from('forums')
        .update({
          topic_count: topicCount,
          post_count: postCount,
          last_topic_id: lastTopicId,
          last_post_at: lastPostAt,
        })
        .eq('id', forumId).eq('topic_count', forum.topic_count).eq('post_count', forum.post_count)
        .select('id'));
      if (updated.length === 1) return true;
    }
    throw new AppError('write_conflict', 409);
  }

  // ── контекст запроса ──────────────────────────────────────────────────────

  async function readViewer(request) {
    const validation = await validateSession(db, request, now());
    if (validation.state !== 'valid') return { user: null, session: null };
    const found = rows(await db.from('users')
      .select('id,display_name,role').eq('id', validation.session.userId).limit(1));
    if (found.length !== 1) return { user: null, session: null };
    return { user: found[0], session: validation.session };
  }

  async function authorized(request) {
    const viewer = await readViewer(request);
    if (!viewer.user) throw new AppError('unauthenticated', 401);
    return viewer;
  }

  async function loadForumOr404(forumId) {
    const found = rows(await db.from('forums')
      .select('id,category_id,slug,title,description,read_role,write_role,prefixes,external_url')
      .eq('id', forumId).limit(1));
    if (found.length !== 1) throw new AppError('not_found', 404);
    return found[0];
  }

  async function limitOrThrow(scope, principal) {
    const result = await consume(db, scope, principal, now());
    if (!result.allowed) {
      const retry = Math.max(1, Math.ceil((result.retryAfterMs ?? 0) / 1000));
      throw new AppError(`rate_limited:${scope}:${retry}`, 429);
    }
  }

  // ── GET /api/board ────────────────────────────────────────────────────────

  async function board(request, viewer) {
    await ensureStructure(db, now());
    const [categories, forums, previews] = await Promise.all([loadCategories(), loadForums(), latestPreview()]);
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const byCategory = new Map();
    for (const category of categories) {
      if (!canRead(viewer.user?.role ?? 'guest', { read_role: category.read_role })) continue;
      byCategory.set(category.id, {
        id: category.id, slug: category.slug, title: category.title, forums: [],
      });
    }
    const visible = [];
    for (const forum of forums) {
      const group = byCategory.get(forum.category_id);
      if (!group || !forumVisible(viewer.user?.role ?? 'guest', forum, categoryMap)) continue;
      visible.push(forum);
      const shaped = shapeForum(forum);
      shaped.last_topic = previews.get(forum.id) ?? null;
      group.forums.push(shaped);
    }
    return json({
      me: viewer.user ? publicUser(viewer.user) : null,
      categories: [...byCategory.values()],
      // Считаем только то, что зрителю видно: иначе статистика выдаёт служебные разделы.
      stats: await stats(visible),
    });
  }

  async function stats(forums) {
    // Служебный аккаунт стартовых тем — не игрок: в статистике только живые регистрации.
    const systemId = await stableUuid('user:system');
    const members = rows(await db.from('users')
      .select('id,display_name,created_at').order('created_at', { ascending: false }).limit(500))
      .filter((user) => user.id !== systemId);
    let topicCount = 0;
    let postCount = 0;
    let lastPostAt = null;
    for (const forum of forums) {
      if (!Number.isSafeInteger(forum.topic_count) || !Number.isSafeInteger(forum.post_count)) continue;
      topicCount += forum.topic_count;
      postCount += forum.post_count;
      const at = Date.parse(forum.last_post_at ?? '');
      if (Number.isFinite(at) && (lastPostAt === null || at > lastPostAt)) lastPostAt = at;
    }
    return {
      topic_count: topicCount,
      post_count: postCount,
      member_count: members.length,
      newest_member: members.length > 0 ? members[0].display_name : null,
      last_post_at: lastPostAt === null ? null : iso(lastPostAt),
      limits: Object.fromEntries(Object.entries(LIMITS).map(([key, value]) => [key, value.maxAttempts])),
    };
  }

  // ── GET /api/forum ────────────────────────────────────────────────────────

  async function forumPage(request, viewer) {
    const forumId = new URL(request.url).searchParams.get('id');
    if (!isUuid(forumId)) throw new AppError('invalid_input', 400);
    const forum = await loadForumOr404(forumId);
    const role = viewer.user?.role ?? 'guest';
    if (!canRead(role, forum)) throw new AppError('forbidden', 403);

    const page = intParam(request, 'page', 1, 500);
    const offset = (page - 1) * TOPICS_PER_PAGE;
    const all = rows(await db.from('topics')
      .select('id,title,prefix,author_name,author_role,created_at,last_post_at,last_poster_name,reply_count,view_count,is_pinned,is_locked,forum_id')
      .eq('forum_id', forumId).eq('is_deleted', false)
      .order('last_post_at', { ascending: false })
      .limit(offset + TOPICS_PER_PAGE + 1));
    const visible = all.filter((topic) => Number.isSafeInteger(topic.reply_count));
    const pinned = visible.filter((topic) => topic.is_pinned === true);
    const regular = visible.filter((topic) => topic.is_pinned !== true);
    const ordered = [...pinned, ...regular];
    const slice = ordered.slice(offset, offset + TOPICS_PER_PAGE);
    return json({
      me: viewer.user ? publicUser(viewer.user) : null,
      forum: {
        ...shapeForum(forum),
        category_id: forum.category_id,
      },
      page,
      has_more: ordered.length > offset + slice.length,
      can_write: canWrite(role, forum),
      topics: slice.map((topic) => ({
        id: topic.id, title: topic.title, prefix: topic.prefix ?? '',
        author_name: topic.author_name, author_role: topic.author_role,
        created_at: topic.created_at, last_post_at: topic.last_post_at,
        last_poster_name: topic.last_poster_name,
        replies: topic.reply_count, views: Number.isSafeInteger(topic.view_count) ? topic.view_count : 0,
        is_pinned: topic.is_pinned === true, is_locked: topic.is_locked === true,
      })),
    });
  }

  // ── GET /api/topic ────────────────────────────────────────────────────────

  async function topicPage(request, viewer) {
    const topicId = new URL(request.url).searchParams.get('id');
    if (!isUuid(topicId)) throw new AppError('invalid_input', 400);
    const found = rows(await db.from('topics')
      .select('id,forum_id,title,prefix,author_name,author_role,created_at,last_post_at,reply_count,view_count,is_pinned,is_locked,is_deleted')
      .eq('id', topicId).limit(1));
    if (found.length !== 1 || found[0].is_deleted === true) throw new AppError('not_found', 404);
    const topic = found[0];
    const forum = await loadForumOr404(topic.forum_id);
    const role = viewer.user?.role ?? 'guest';
    if (!canRead(role, forum)) throw new AppError('forbidden', 403);

    const page = intParam(request, 'page', 1, 500);
    const offset = (page - 1) * POSTS_PER_PAGE;
    const totalReplies = Number.isSafeInteger(topic.reply_count) ? topic.reply_count : 0;
    const posts = rows(await db.from('posts')
      .select('id,floor,author_name,author_role,body,created_at,edited_at,is_deleted')
      .eq('topic_id', topicId).eq('is_deleted', false)
      .order('floor')
      .limit(offset + POSTS_PER_PAGE + 1));
    const shown = posts.slice(offset, offset + POSTS_PER_PAGE);

    // Просмотр считаем только для входа в тему, не для перелистывания страниц.
    let views = Number.isSafeInteger(topic.view_count) ? topic.view_count : 0;
    if (page === 1) {
      for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const updated = rows(await db.from('topics')
          .update({ view_count: views + 1 }).eq('id', topicId).eq('view_count', views).select('id'));
        if (updated.length === 1) { views += 1; break; }
        const reread = rows(await db.from('topics').select('view_count').eq('id', topicId).limit(1));
        views = Number.isSafeInteger(reread[0]?.view_count) ? reread[0].view_count : views;
      }
    }

    return json({
      me: viewer.user ? publicUser(viewer.user) : null,
      topic: {
        id: topic.id, forum_id: topic.forum_id, title: topic.title, prefix: topic.prefix ?? '',
        author_name: topic.author_name, author_role: topic.author_role,
        created_at: topic.created_at, last_post_at: topic.last_post_at,
        replies: totalReplies, views,
        is_pinned: topic.is_pinned === true, is_locked: topic.is_locked === true,
      },
      forum: { ...shapeForum(forum), category_id: forum.category_id },
      page,
      posts_per_page: POSTS_PER_PAGE,
      total_posts: totalReplies + 1,
      can_reply: canWrite(role, forum) && topic.is_locked !== true,
      can_moderate: roleAtLeast(role, 'helper'),
      posts: shown.map((post) => ({
        id: post.id, floor: post.floor, author_name: post.author_name, author_role: post.author_role,
        body: post.body, created_at: post.created_at, edited_at: post.edited_at ?? null,
      })),
    });
  }

  // ── GET /api/latest ───────────────────────────────────────────────────────

  async function latest(request, viewer) {
    const page = intParam(request, 'page', 1, 200);
    const role = viewer.user?.role ?? 'guest';
    const [forums, categories] = await Promise.all([loadForums(), loadCategories()]);
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const forumMap = new Map(forums.map((forum) => [forum.id, forum]));
    const offset = (page - 1) * LATEST_PER_PAGE;
    const posts = rows(await db.from('posts')
      .select('id,topic_id,floor,author_name,author_role,body,created_at,is_deleted')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(offset + LATEST_PER_PAGE + 1));
    const items = [];
    for (const post of posts) {
      const topic = rows(await db.from('topics')
        .select('id,forum_id,title,is_deleted,is_locked').eq('id', post.topic_id).limit(1))[0];
      if (!topic || topic.is_deleted === true) continue;
      const forum = forumMap.get(topic.forum_id);
      if (!forum || !forumVisible(role, forum, categoryMap)) continue;
      if (!Number.isSafeInteger(post.floor)) continue;
      items.push({
        id: post.id, topic_id: topic.id, topic_title: topic.title, floor: post.floor,
        author_name: post.author_name, author_role: post.author_role, created_at: post.created_at,
        excerpt: post.body.slice(0, 180),
        forum_id: forum.id, forum_title: forum.title,
      });
      if (items.length === LATEST_PER_PAGE) break;
    }
    return json({ me: viewer.user ? publicUser(viewer.user) : null, page, has_more: posts.length > offset + LATEST_PER_PAGE, items });
  }

  // ── GET /api/search ───────────────────────────────────────────────────────

  async function search(request, viewer) {
    const query = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase();
    if (query.length < 2) throw new AppError('invalid_input', 400);
    const role = viewer.user?.role ?? 'guest';
    const [forums, categories] = await Promise.all([loadForums(), loadCategories()]);
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const topics = rows(await db.from('topics')
      .select('id,forum_id,title,prefix,author_name,last_post_at,reply_count,is_deleted')
      .eq('is_deleted', false)
      .order('last_post_at', { ascending: false })
      .limit(SEARCH_SCAN_TOPICS));
    const words = query.split(/\s+/).filter(Boolean);
    const items = [];
    for (const topic of topics) {
      const forum = forums.find((candidate) => candidate.id === topic.forum_id);
      if (!forum || !forumVisible(role, forum, categoryMap)) continue;
      const haystack = `${topic.title} ${topic.author_name}`.toLowerCase();
      if (!words.every((word) => haystack.includes(word))) continue;
      items.push({
        id: topic.id, forum_id: forum.id, forum_title: forum.title, title: topic.title,
        prefix: topic.prefix ?? '', author_name: topic.author_name,
        last_post_at: topic.last_post_at,
        replies: Number.isSafeInteger(topic.reply_count) ? topic.reply_count : 0,
      });
      if (items.length === 50) break;
    }
    return json({ me: viewer.user ? publicUser(viewer.user) : null, query, items, scanned: topics.length });
  }

  // ── POST /api/topic ───────────────────────────────────────────────────────

  async function createTopic(request, viewer) {
    const { user } = await authorized(request);
    const body = await readJson(request);
    const forumId = body?.forum_id;
    if (!isUuid(forumId)) throw new AppError('invalid_input', 400);
    const forum = await loadForumOr404(forumId);
    const role = user.role;
    if (!canRead(role, forum) || !canWrite(role, forum)) throw new AppError('forbidden', 403);
    const title = text(body?.title, MAX_TITLE_CHARS, 'invalid_title');
    const content = text(body?.body, MAX_BODY_CHARS, 'invalid_body');
    const allowed = Array.isArray(forum.prefixes) ? forum.prefixes : [];
    const prefix = typeof body?.prefix === 'string' && allowed.includes(body.prefix) ? body.prefix : '';
    await limitOrThrow('topic', user.id);

    const timestamp = iso(now());
    const topicId = crypto.randomUUID();
    const postId = crypto.randomUUID();
    const inserted = rows(await db.from('topics').insertIfAbsent({
      id: topicId, forum_id: forumId, title, prefix,
      author_id: user.id, author_name: user.display_name, author_role: user.role,
      created_at: timestamp, last_post_at: timestamp, last_poster_name: user.display_name,
      reply_count: 0, view_count: 1, is_pinned: false, is_locked: false, is_deleted: false,
    }, { onConflict: 'id' }).select('id'));
    if (inserted.length !== 1) throw new AppError('write_conflict', 409);
    rows(await db.from('posts').insertIfAbsent({
      id: postId, topic_id: topicId, floor: 1,
      author_id: user.id, author_name: user.display_name, author_role: user.role,
      body: content, created_at: timestamp, edited_at: null, is_deleted: false,
    }, { onConflict: 'id' }).select('id'));
    await bumpForum(forumId, 1, 1, topicId, timestamp);
    return json({ topic_id: topicId, post_id: postId }, 201);
  }

  // ── POST /api/reply ───────────────────────────────────────────────────────

  async function createReply(request, viewer) {
    const { user } = await authorized(request);
    const body = await readJson(request);
    const topicId = body?.topic_id;
    if (!isUuid(topicId)) throw new AppError('invalid_input', 400);
    const content = text(body?.body, MAX_BODY_CHARS, 'invalid_body');
    await limitOrThrow('reply', user.id);

    const found = rows(await db.from('topics')
      .select('id,forum_id,title,is_deleted').eq('id', topicId).limit(1));
    if (found.length !== 1 || found[0].is_deleted === true) throw new AppError('not_found', 404);
    const topic = found[0];
    const forum = await loadForumOr404(topic.forum_id);
    if (!canRead(user.role, forum) || !canWrite(user.role, forum)) throw new AppError('forbidden', 403);

    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const current = rows(await db.from('topics')
        .select('id,reply_count,is_locked').eq('id', topicId).limit(1));
      if (current.length !== 1) throw new AppError('not_found', 404);
      if (current[0].is_locked === true) throw new AppError('topic_locked', 409);
      const replies = Number.isSafeInteger(current[0].reply_count) ? current[0].reply_count : 0;
      const timestamp = iso(now());
      const updated = rows(await db.from('topics')
        .update({ reply_count: replies + 1, last_post_at: timestamp, last_poster_name: user.display_name })
        .eq('id', topicId).eq('reply_count', replies).select('id'));
      if (updated.length !== 1) continue;
      const inserted = rows(await db.from('posts').insertIfAbsent({
        id: crypto.randomUUID(), topic_id: topicId, floor: replies + 2,
        author_id: user.id, author_name: user.display_name, author_role: user.role,
        body: content, created_at: timestamp, edited_at: null, is_deleted: false,
      }, { onConflict: 'id' }).select('id,floor,created_at'));
      if (inserted.length !== 1) throw new AppError('write_conflict', 409);
      await bumpForum(topic.forum_id, 0, 1, topicId, timestamp);
      return json({ post: inserted[0], replies: replies + 1 }, 201);
    }
    throw new AppError('write_conflict', 409);
  }

  // ── POST /api/moderate ────────────────────────────────────────────────────

  const MODERATION = {
    pin: { need: 'helper', field: 'is_pinned', value: true },
    unpin: { need: 'helper', field: 'is_pinned', value: false },
    lock: { need: 'helper', field: 'is_locked', value: true },
    unlock: { need: 'helper', field: 'is_locked', value: false },
    delete_topic: { need: 'admin', field: 'is_deleted', value: true },
    restore_topic: { need: 'admin', field: 'is_deleted', value: false },
  };

  async function moderate(request) {
    const { user } = await authorized(request);
    const body = await readJson(request);
    const action = typeof body?.action === 'string' ? body.action : '';
    const rule = MODERATION[action];
    if (!rule) throw new AppError('invalid_input', 400);
    requireRole(user, rule.need);
    const topicId = body?.topic_id;
    if (!isUuid(topicId)) throw new AppError('invalid_input', 400);
    const found = rows(await db.from('topics').select('id,forum_id,is_deleted').eq('id', topicId).limit(1));
    if (found.length !== 1) throw new AppError('not_found', 404);
    const forum = await loadForumOr404(found[0].forum_id);
    // Служебное дерево видно только персоналу: гость/игрок не должен снимать
    // модерацию с чужих тем через прямой id.
    if (!canRead(user.role, forum)) throw new AppError('forbidden', 403);
    const updated = rows(await db.from('topics')
      .update({ [rule.field]: rule.value }).eq('id', topicId).select('id'));
    if (updated.length !== 1) throw new AppError('write_conflict', 409);
    return json({ ok: true, action, topic_id: topicId });
  }

  // ── авторизация ───────────────────────────────────────────────────────────

  async function register(request) {
    const body = await readJson(request);
    const canonical = canonicalUsername(body?.username);
    const shown = displayName(body?.username);
    const password = validatePassword(body?.password);
    await ensureStructure(db, now());
    await limitOrThrow('register', canonical);

    const taken = rows(await db.from('users').select('id').eq('username', canonical).limit(1));
    if (taken.length > 0) throw new AppError('username_taken', 409);
    const material = await hashPassword(password);
    const userId = crypto.randomUUID();
    const inserted = rows(await db.from('users').insertIfAbsent({
      id: userId, username: canonical, display_name: shown,
      password_salt: material.salt, password_hash: material.hash,
      password_iterations: material.iterations, role: 'member',
      created_at: iso(now()),
    }, { onConflict: 'username' }).select('id,display_name,role'));
    if (inserted.length !== 1) throw new AppError('write_conflict', 409);
    const session = await createSession(db, userId, now());
    return json({ me: publicUser(inserted[0]) }, 201, { 'set-cookie': sessionCookie(session.token, Math.floor(SESSION_TTL_MS / 1000)) });
  }

  async function login(request) {
    const body = await readJson(request);
    const canonical = canonicalUsername(body?.username);
    const password = typeof body?.password === 'string' ? body.password : '';
    await limitOrThrow('login', canonical);

    const found = rows(await db.from('users')
      .select('id,display_name,role,password_salt,password_hash,password_iterations')
      .eq('username', canonical).limit(1));
    if (found.length !== 1) {
      await verifyPasswordAgainstDummy(password || 'placeholder-password');
      throw new AppError('invalid_credentials', 401);
    }
    const user = found[0];
    const ok = await verifyPassword(password, {
      salt: user.password_salt, hash: user.password_hash, iterations: user.password_iterations,
    });
    if (!ok) throw new AppError('invalid_credentials', 401);
    const session = await createSession(db, user.id, now());
    return json({ me: publicUser(user) }, 200, { 'set-cookie': sessionCookie(session.token, Math.floor(SESSION_TTL_MS / 1000)) });
  }

  async function logout(viewer) {
    if (viewer.session) await db.from('sessions').update({ revoked_at: iso(now()) }).eq('token_digest', viewer.session.digest).select('token_digest');
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
  }

  // ── диспетчер ─────────────────────────────────────────────────────────────

  return async function handle(ctx) {
    const request = ctx.request ?? ctx;
    let response;
    try {
      const path = applicationPath(request);
      requireTrustedOrigin(request, env('APP_ORIGIN'));
      const viewer = await readViewer(request);

      if (path === '/api/board' && request.method === 'GET') response = await board(request, viewer);
      else if (path === '/api/forum' && request.method === 'GET') response = await forumPage(request, viewer);
      else if (path === '/api/topic' && request.method === 'GET') response = await topicPage(request, viewer);
      else if (path === '/api/latest' && request.method === 'GET') response = await latest(request, viewer);
      else if (path === '/api/search' && request.method === 'GET') response = await search(request, viewer);
      else if (path === '/api/me' && request.method === 'GET') {
        response = json({ me: viewer.user ? publicUser(viewer.user) : null });
      } else if (path === '/api/register' && request.method === 'POST') response = await register(request);
      else if (path === '/api/login' && request.method === 'POST') response = await login(request);
      else if (path === '/api/logout' && request.method === 'POST') response = await logout(viewer);
      else if (path === '/api/topic/create' && request.method === 'POST') response = await createTopic(request, viewer);
      else if (path === '/api/reply' && request.method === 'POST') response = await createReply(request, viewer);
      else if (path === '/api/moderate' && request.method === 'POST') response = await moderate(request);
      else if (path === '/') response = json({ ok: true, service: 'premaze-forum' });
      else throw new AppError('not_found', 404);
    } catch (error) {
      response = failure(error);
    }
    return response;
  };
}

function failure(error) {
  if (error instanceof AppError) {
    if (error.code.startsWith('rate_limited:')) {
      const parts = error.code.split(':');
      // Скоуп и секунды наружу: по ним фронт собирает человекочитаемое «повтори через N».
      return errorJson(error.code, error.status, { 'retry-after': parts[2] ?? '60' });
    }
    return errorJson(error.code, error.status);
  }
  // Сообщения сторонних модулей не уходят клиенту: там может быть текст провайдера.
  return errorJson('internal', 500);
}
