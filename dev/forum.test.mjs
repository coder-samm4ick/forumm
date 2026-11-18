// Офлайн-прогон настоящих маршрутов на fake-БД: node --test dev/forum.test.mjs
// Никаких облачных ключей: платформа здесь только как источник обёртки БД, её подменяем.
import test from 'node:test';
import assert from 'node:assert/strict';
import { application } from '../functions/router.mjs';
import { FALLBACK_ORIGINS } from '../functions/http.mjs';
import { createFakeDb } from './fake-db.mjs';

const NOW = Date.parse('2026-11-06T12:00:00.000Z');
const clock = { value: NOW };

function setup() {
  const db = createFakeDb();
  const handle = application({ db, now: () => clock.value });
  const jar = { cookie: null };

  async function call(method, path, body) {
    const headers = { origin: FALLBACK_ORIGINS };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (jar.cookie) headers.cookie = jar.cookie;
    const response = await handle({
      request: new Request(`https://example.dev/functions/v1/app${path}`, {
        method, headers, body: body === undefined ? null : JSON.stringify(body),
      }),
    });
    const setCookie = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
    for (const value of setCookie) {
      const pair = value.split(';')[0];
      if (pair.endsWith('=')) jar.cookie = null;
      else jar.cookie = pair;
    }
    clock.value += 1000;
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    return { status: response.status, body: payload, headers: response.headers };
  }

  return { db, call, jar, handle };
}

function pick(store, table, predicate) {
  return store[table].find(predicate);
}

// Раздел, куда ordinary player имеет право писать: внешний узел и служебные не подходят.
function writableForum(board) {
  return board.body.categories.flatMap((category) => category.forums)
    .find((forum) => !forum.external_url && forum.write_role === 'member');
}

test('регистрация, вход и повторный ник', async () => {
  const { call, db } = setup();

  const registered = await call('POST', '/api/register', { username: 'Ivan Petrov', password: 'samolet777' });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.me.username, 'Ivan Petrov');
  assert.equal(registered.body.me.role, 'member');

  const me = await call('GET', '/api/me');
  assert.equal(me.body.me.username, 'Ivan Petrov');

  const duplicate = await call('POST', '/api/register', { username: 'ivan  petrov', password: 'samolet777' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, 'username_taken');

  const badPassword = await call('POST', '/api/login', { username: 'Ivan Petrov', password: 'wrongpassword' });
  assert.equal(badPassword.status, 401);

  const ghost = await call('POST', '/api/login', { username: 'net-takogo', password: 'whatever123' });
  assert.equal(ghost.status, 401);

  const loggedOut = await call('POST', '/api/logout', {});
  assert.equal(loggedOut.status, 200);
  assert.equal((await call('GET', '/api/me')).body.me, null);
  assert.equal(typeof pick(db.store, 'sessions', () => true).revoked_at, 'string');

  const again = await call('POST', '/api/login', { username: 'Ivan Petrov', password: 'samolet777' });
  assert.equal(again.status, 200);
  assert.equal(again.body.me.username, 'Ivan Petrov');
});

test('дерево разделов сеется один раз и видно гостю', async () => {
  const { call, db } = setup();
  const first = await call('GET', '/api/board');
  assert.equal(first.status, 200);
  const titles = first.body.categories.map((category) => category.title);
  assert.ok(titles.includes('Важные ссылки'));

  const forums = first.body.categories.flatMap((category) => category.forums);
  assert.ok(forums.length > 15, 'разделов должно быть больше 15');
  assert.ok(forums.every((forum) => forum.topic_count >= 0));
  assert.ok(forums.some((forum) => forum.external_url), 'внешние ссылки есть');
  // Гость в статистике видит те же темы, что и в дереве, — без служебных разделов.
  assert.equal(first.body.stats.topic_count, forums.reduce((sum, forum) => sum + forum.topic_count, 0));

  // Служебное дерево гостю не показывают, и повторный board не досевает строки.
  const staffSeen = forums.filter((forum) => forum.read_role !== 'guest');
  assert.equal(staffSeen.length, 0);
  const categoryCount = db.store.categories.length;
  await call('GET', '/api/board');
  assert.equal(db.store.categories.length, categoryCount);
  assert.ok(db.store.topics.length > 20, 'стартовые темы на месте');
  // Служебный аккаунт, который автор стартовых тем, игроком не считается.
  assert.equal(first.body.stats.member_count, 0);
  assert.equal(first.body.stats.newest_member, null);
  assert.ok(db.store.forums.every((forum) => forum.topic_count === db.store.topics.filter((topic) => topic.forum_id === forum.id && topic.is_deleted === false).length));
});

test('гость не пишет, игрок создаёт тему и ответ, счётчики сходятся', async () => {
  const { call, db } = setup();
  const board = await call('GET', '/api/board');
  const target = writableForum(board);

  const anonymous = await call('POST', '/api/topic/create', { forum_id: target.id, title: 'Тестовая тема', body: 'Текст' });
  assert.equal(anonymous.status, 401);

  await call('POST', '/api/register', { username: 'Player One', password: 'samolet777' });

  const before = db.store.forums.find((forum) => forum.id === target.id);
  const topicsBefore = before.topic_count;
  const postsBefore = before.post_count;
  const created = await call('POST', '/api/topic/create', { forum_id: target.id, title: 'Как жить в White', body: 'Расскажите про работу.' });
  assert.equal(created.status, 201);

  const after = db.store.forums.find((forum) => forum.id === target.id);
  assert.equal(after.topic_count, topicsBefore + 1);
  assert.equal(after.post_count, postsBefore + 1);
  assert.equal(after.last_topic_id, created.body.topic_id);

  const replied = await call('POST', '/api/reply', { topic_id: created.body.topic_id, body: 'Ответ номер один' });
  assert.equal(replied.status, 201);
  assert.equal(replied.body.post.floor, 2);

  const topic = await call('GET', `/api/topic?id=${created.body.topic_id}`);
  assert.equal(topic.body.topic.replies, 1);
  assert.equal(topic.body.posts.length, 2);
  assert.equal(topic.body.posts[0].floor, 1);
  assert.equal(topic.body.can_reply, true);

  const second = await call('POST', '/api/reply', { topic_id: created.body.topic_id, body: 'Ответ номер два' });
  assert.equal(second.body.post.floor, 3);
  assert.equal(db.store.forums.find((forum) => forum.id === target.id).post_count, postsBefore + 3);
});

test('права: служебный раздел, закрепление и блокировка', async () => {
  const { call, db } = setup();
  await call('GET', '/api/board');
  const staff = db.store.forums.find((forum) => forum.read_role === 'helper');
  assert.ok(staff, 'служебный раздел существует');

  await call('POST', '/api/register', { username: 'Helper One', password: 'samolet777' });
  const member = db.store.users.find((user) => user.username === 'helper one');
  member.role = 'helper';

  const opened = await call('GET', `/api/forum?id=${staff.id}`);
  assert.equal(opened.status, 200);

  const board = await call('GET', '/api/board');
  assert.ok(board.body.categories.flatMap((category) => category.forums).some((forum) => forum.id === staff.id));

  const playerTopic = db.store.topics[0];
  const pinned = await call('POST', '/api/moderate', { action: 'pin', topic_id: playerTopic.id });
  assert.equal(pinned.status, 200);
  assert.equal(db.store.topics.find((topic) => topic.id === playerTopic.id).is_pinned, true);

  const deletion = await call('POST', '/api/moderate', { action: 'delete_topic', topic_id: playerTopic.id });
  assert.equal(deletion.status, 403, 'хелпер не удаляет темы');

  member.role = 'admin';
  const adminDelete = await call('POST', '/api/moderate', { action: 'delete_topic', topic_id: playerTopic.id });
  assert.equal(adminDelete.status, 200);
  const gone = await call('GET', `/api/topic?id=${playerTopic.id}`);
  assert.equal(gone.status, 404);
});

test('закрытая тема не принимает ответов', async () => {
  const { call, db } = setup();
  const board = await call('GET', '/api/board');
  const target = writableForum(board);
  await call('POST', '/api/register', { username: 'Quiet Kid', password: 'samolet777' });
  const created = await call('POST', '/api/topic/create', { forum_id: target.id, title: 'Нечего обсуждать', body: 'Текст' });

  await call('POST', '/api/register', { username: 'Boss Man', password: 'samolet777' });
  const boss = db.store.users.find((user) => user.username === 'boss man');
  boss.role = 'admin';
  await call('POST', '/api/moderate', { action: 'lock', topic_id: created.body.topic_id });

  const ordinary = await call('POST', '/api/reply', { topic_id: created.body.topic_id, body: 'А я хочу' });
  assert.equal(ordinary.status, 409);
  assert.equal(ordinary.body.error, 'topic_locked');
});

test('лимитер: темы и попытки входа', async () => {
  const { call, db } = setup();
  const board = await call('GET', '/api/board');
  const target = writableForum(board);
  await call('POST', '/api/register', { username: 'Flood Man', password: 'samolet777' });

  for (let index = 0; index < 8; index += 1) {
    const ok = await call('POST', '/api/topic/create', { forum_id: target.id, title: `Тема ${index}`, body: 'Текст' });
    assert.equal(ok.status, 201, `тема ${index} должна пройти`);
  }
  const blocked = await call('POST', '/api/topic/create', { forum_id: target.id, title: 'Тема 9', body: 'Текст' });
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /^rate_limited:topic:/);

  // та же сессия может отвечать: лимит на ответы отдельный
  const topicId = db.store.topics[db.store.topics.length - 1].id;
  const reply = await call('POST', '/api/reply', { topic_id: topicId, body: 'Ответ после лимита тем' });
  assert.equal(reply.status, 201);

  clock.value += 31 * 60 * 1000;
  const later = await call('POST', '/api/topic/create', { forum_id: target.id, title: 'Тема после окна', body: 'Текст' });
  assert.equal(later.status, 201);

  const attempts = [];
  for (let index = 0; index < 11; index += 1) attempts.push(await call('POST', '/api/login', { username: 'Flood Man', password: 'wrongwrong' }));
  assert.ok(attempts.slice(0, 10).every((response) => response.status === 401), 'первые 10 попыток — просто неверный пароль');
  assert.equal(attempts[10].status, 429);
  assert.match(attempts[10].body.error, /^rate_limited:login:/);
});

test('поиск и лента новых сообщений', async () => {
  const { call } = setup();
  const board = await call('GET', '/api/board');
  const target = writableForum(board);
  await call('POST', '/api/register', { username: 'Search Er', password: 'samolet777' });
  await call('POST', '/api/topic/create', { forum_id: target.id, title: 'Пропал микрофон в CEF', body: 'Описание проблемы' });

  const found = await call('GET', '/api/search?q=микрофон');
  assert.equal(found.status, 200);
  assert.equal(found.body.items.length, 1);

  const nothing = await call('GET', '/api/search?q=такого-нет');
  assert.equal(nothing.body.items.length, 0);

  const latest = await call('GET', '/api/latest');
  assert.equal(latest.status, 200);
  assert.ok(latest.body.items.length > 0);
  assert.ok(latest.body.items.every((item) => typeof item.topic_id === 'string'));

  const short = await call('GET', '/api/search?q=а');
  assert.equal(short.status, 400);
});

test('плохие запросы и чужие пути', async () => {
  const { call, handle, jar } = setup();
  assert.equal((await call('GET', '/api/forum?id=не-uuid')).status, 400);
  assert.equal((await call('GET', '/api/board?page=99999')).status, 200);

  const foreign = await handle({
    request: new Request('https://example.dev/functions/v1/other/api/board', { method: 'GET', headers: { origin: FALLBACK_ORIGINS } }),
  });
  assert.equal(foreign.status, 404);

  const hostile = await handle({
    request: new Request('https://example.dev/functions/v1/app/api/board', { method: 'GET', headers: { origin: 'https://evil.example' } }),
  });
  assert.equal(hostile.status, 200, 'GET читаем с любого источника');

  const forgedPost = await handle({
    request: new Request('https://example.dev/functions/v1/app/api/reply', {
      method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}',
    }),
  });
  assert.equal(forgedPost.status, 403);

  await call('POST', '/api/register', { username: 'Form Attack', password: 'samolet777' });
  // Авторизация идёт до разбора тела, поэтому проверяем guard на content-type уже с валидной сессией.
  const noType = await handle({
    request: new Request('https://example.dev/functions/v1/app/api/topic/create', {
      method: 'POST', headers: { origin: FALLBACK_ORIGINS, cookie: jar.cookie }, body: '{"a":1}',
    }),
  });
  assert.equal(noType.status, 400);
});
