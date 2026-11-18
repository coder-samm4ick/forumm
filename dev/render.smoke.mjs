// Смоук-тест фронтенда: прогон web/app.js по реальным payload'ам живого форума.
// Сеть не трогаем — фикстуры сняты curl'ом, стаб-DOM собирает innerHTML.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const here = path.dirname(new URL(import.meta.url).pathname.slice(1));
const source = fs.readFileSync(path.join(here, '../web/app.js'), 'utf8');
const fixtures = {};
for (const name of ['board', 'forum', 'topic', 'latest', 'search']) {
  fixtures[name] = fs.readFileSync(path.join(here, `_fix_${name}.json`), 'utf8');
}
const ids = {
  forumSlug: JSON.parse(fixtures.forum).forum.slug,
  forumId: JSON.parse(fixtures.forum).forum.id,
  topicId: JSON.parse(fixtures.topic).topic.id,
};

const nodes = new Map();
function node(id) {
  if (nodes.has(id)) return nodes.get(id);
  const made = {
    id, value: '', textContent: '', innerHTML: '', hidden: false, disabled: false,
    dataset: {}, style: {}, attrs: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    addEventListener() {}, appendChild() {}, focus() {}, blur() {},
    closest: () => null, scrollIntoView() {}, showModal() {}, close() {},
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
  };
  nodes.set(id, made);
  return made;
}

const hostLocation = { hash: '#/' };
const context = vm.createContext({
  console, setTimeout, clearTimeout, URL, URLSearchParams, Math, Date, JSON,
  Object, Array, Number, String, Boolean, Promise, Set, Map, RegExp, Error,
  isNaN, parseInt, parseFloat, Intl,
  document: {
    documentElement: { dataset: {} },
    getElementById: node,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => node('created-' + Math.random()),
    body: node('body'),
  },
  window: { addEventListener() {}, scrollTo() {}, location: hostLocation },
  location: hostLocation,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  fetch: async (url, options) => {
    const path_ = String(url).split('?')[0];
    const key = path_.split('/api/')[1];
    if (!fixtures[key]) return { ok: false, status: 404, json: async () => ({ error: 'no_route' }) };
    if (options?.method && options.method !== 'GET') {
      return { ok: false, status: 405, json: async () => ({ error: 'smoke_test_is_read_only' }) };
    }
    return { ok: true, status: 200, json: async () => JSON.parse(fixtures[key]) };
  },
});

vm.runInContext(source, context, { filename: 'app.js' });

const RENDERED = ['view', 'sidebar', 'session-slot', 'crumbs', 'page-title', 'page-title-labels', 'title-action'];

async function render(hash) {
  hostLocation.hash = hash;
  for (const id of RENDERED) node(id).innerHTML = '';
  await context.route();
  await new Promise((resolve) => setTimeout(resolve, 30));
  return RENDERED.map((id) => node(id).innerHTML).join('\n<!-- -->\n');
}

const cases = [
  ['главная', '#/'],
  ['раздел по slug', `#/forum/${ids.forumSlug}`],
  ['раздел по id', `#/forum/${ids.forumId}?page=1`],
  ['тема', `#/topic/${ids.topicId}`],
  ['лента', '#/latest?page=1'],
  ['поиск', '#/search?q=%D0%BF%D1%80%D0%B0%D0%B2'],
  ['неизвестный путь', '#/net-takoj-stranicy'],
];

for (const [label, hash] of cases) {
  test(`рендер: ${label}`, async () => {
    const html = await render(hash);
    assert.ok(html.length > 20, 'страница отдалась пустой');
    assert.ok(!/undefined/.test(html), 'в разметке появился undefined');
    assert.ok(!/NaN/.test(html), 'в разметке появился NaN');
    assert.ok(!/\[object Object\]/.test(html), 'объект ушёл в строку');
    assert.ok(!/><(a|div) class="node-title" href="#\/forum\/undefined/.test(html), 'битая ссылка на раздел');
  });
}

test('главная содержит блоки AMAZING-каркаса', async () => {
  const html = await render('#/');
  for (const marker of ['block block--category', 'block-container', 'block-header', 'node-icon', 'node-stats', 'pairs', 'node-latest', 'startBox']) {
    assert.ok(html.includes(marker), `нет ${marker}`);
  }
  assert.ok(!/dataList-row|dataList-cell|message-container|thread-title|nav-tab/.test(html), 'остались классы старого каркаса');
});

test('раздел рендерит structItem и заголовок страницы', async () => {
  const html = await render(`#/forum/${ids.forumSlug}`);
  assert.ok(html.includes('structItem-cell structItem-cell--main'), 'нет строк списка');
  assert.ok(html.includes('dataList-header'), 'нет шапки списка');
  assert.ok(html.includes('p-navgroup-link--register'), 'нет гостевых кнопок в навигации');
});

test('тема рендерит колонку пользователя и bbWrapper', async () => {
  const html = await render(`#/topic/${ids.topicId}`);
  assert.ok(html.includes('message-userCol'), 'нет колонки автора');
  assert.ok(html.includes('avatar avatar--m'), 'нет аватара 48 px');
  assert.ok(html.includes('bbWrapper'), 'нет тела сообщения');
  assert.ok(html.includes('message-attribution'), 'нет строки мета сообщения');
});
