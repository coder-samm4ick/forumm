// Фронт форума Premazing. Один файл, без сборки: hash-роутер + вызовы того же origin.
// Тело поста рендерит mini-markdown, который сначала экранирует HTML — пользовательский
// разметочный текст не может принести тег.

const API = '/functions/v1/app/api';

const MESSAGES = {
  unauthenticated: 'Нужно войти на форум.',
  forbidden: 'Недостаточно прав для этого раздела.',
  invalid_username: 'Ник: 3–24 символа, буквы/цифры/пробел, без точек подряд.',
  weak_password: 'Пароль должен быть не короче 8 символов.',
  username_taken: 'Такой ник уже занят.',
  invalid_credentials: 'Неверный ник или пароль.',
  invalid_title: 'Заголовок: от 3 до 120 символов.',
  invalid_body: 'Сообщение слишком короткое или слишком длинное (максимум 6000).',
  topic_locked: 'Тема закрыта для ответов.',
  not_found: 'Страница или тема не найдены.',
  database_unavailable: 'База форума недоступна — попробуй через минуту.',
  session_unavailable: 'Не удалось создать сессию, попробуй ещё раз.',
  write_conflict: 'Кто-то обновил эту строку раньше. Повтори действие.',
  origin_forbidden: 'Запрос отклонён: неожиданный источник обращения.',
  origin_not_configured: 'Источник обращения не настроен на сайте.',
  internal: 'Внутренняя ошибка форума.',
};

const ROLE_LABEL = { admin: 'Администрация', dev: 'Разработка', helper: 'Хелпер', member: 'Игрок' };

// ── иконки разделов ───────────────────────────────────────────────────────
// Своя векторная графика: 24×24, штрихом. Подбор по slug, иначе — общий диалог.

const ICONS = {
  news: '<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  rules: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 9h7M9 13h7M9 17h4"/>',
  scales: '<path d="M12 4v16M7 20h10"/><path d="M12 7l-6 2 3 5 3-5zM12 7l6 2-3 5-3-5z"/>',
  download: '<path d="M12 4v10M8 11l4 4 4-4"/><path d="M5 18h14"/>',
  chat: '<path d="M4 6h16v10H9l-5 4z"/>',
  help: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  bug: '<ellipse cx="12" cy="13" rx="4.5" ry="6"/><path d="M12 7V5M9 6L7.5 4.5M15 6l1.5-1.5"/><path d="M7.5 11H4M16.5 11H20M7.5 15H4.5M16.5 15H19.5"/>',
  idea: '<path d="M9 15a5 5 0 1 1 6 0c-.7.7-1 1.3-1 2h-4c0-.7-.3-1.3-1-2z"/><path d="M10 20h4"/>',
  users: '<circle cx="9" cy="9" r="3"/><path d="M4 19a5 5 0 0 1 10 0"/><circle cx="17" cy="10" r="2.5"/><path d="M15 19a4.5 4.5 0 0 1 5-4"/>',
  smile: '<circle cx="12" cy="12" r="8"/><path d="M9 14c.8 1.2 1.8 1.8 3 1.8s2.2-.6 3-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  car: '<path d="M4 15h16M5.5 15l1.5-5h10l1.5 5"/><circle cx="8" cy="17.5" r="1.5"/><circle cx="16" cy="17.5" r="1.5"/>',
  tag: '<path d="M5 11l6-6h7v7l-6 6z"/><circle cx="14.5" cy="9.5" r="1.2"/>',
  key: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H20M17 12v3M14 12v2.5"/>',
  shield: '<path d="M12 4l7 2.5V12c0 4-3 6.5-7 8-4-1.5-7-4-7-8V6.5z"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16"/>',
  media: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M10 10l4 2-4 2z"/>',
  forum: '<path d="M5 6h14v9H8l-3 3z"/><path d="M9 10h6"/>',
};

const ICON_BY_SLUG = [
  [/novosti|anons|obnovleniya/, 'news'],
  [/pravila/, 'rules'],
  [/zakon|zhalob|apellyacij|modera/, 'scales'],
  [/skachat|klient/, 'download'],
  [/discord/, 'chat'],
  [/kak-zaiti|faq|pomosh|dostup/, 'help'],
  [/nedorabotki|bug|tehnich|problemy/, 'bug'],
  [/idei|pozhelaniya/, 'idea'],
  [/kurilka|ostal|soobsh|obsuzhdenie/, 'smile'],
  [/avtozvuk|car|transport/, 'car'],
  [/donat|sotrudnichestvo/, 'tag'],
  [/sluzhebnoye|vnutri-komandy/, 'shield'],
  [/server-white|karta|modelei/, 'globe'],
  [/skriny|klipy/, 'media'],
];

function pickIcon(forum) {
  const haystack = `${forum.slug || ''} ${forum.title || ''}`.toLowerCase();
  for (const [pattern, name] of ICON_BY_SLUG) if (pattern.test(haystack)) return name;
  return 'forum';
}

function svgIcon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.forum}</svg>`;
}

// ── мелкие утилиты ────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeHref(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function num(value) {
  return Number(value || 0).toLocaleString('ru-RU');
}

function fmtDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} ${plural(Math.floor(diff / 60), 'минуту', 'минуты', 'минут')} назад`;
  if (diff < 86400) return `сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function avatarOf(name, size = 'avatar--s') {
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="avatar ${size}" aria-hidden="true">${escapeHtml(letter)}</span>`;
}

function toast(message, isError) {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.classList.toggle('err', Boolean(isError));
  box.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('show'), 4200);
}

function friendlyError(code) {
  if (typeof code === 'string' && code.startsWith('rate_limited:')) {
    const parts = code.split(':');
    const seconds = Math.max(1, Number(parts[2]) || 60);
    return `Слишком часто. Повтори через ${seconds} ${plural(seconds, 'секунду', 'секунды', 'секунд')}.`;
  }
  return MESSAGES[code] || 'Ошибка: ' + String(code || 'unknown');
}

function setCrumbs(html) {
  document.getElementById('crumbs').innerHTML = '<a href="#/">Форумы</a>' + (html || '');
}

// Заголовок страницы живёт над телом (как в оригинале), а не в шапке блока.
function setPageTitle(title, labels = '', action = '') {
  document.getElementById('page-title').innerHTML = title;
  document.getElementById('page-title-labels').innerHTML = labels;
  document.getElementById('title-action').innerHTML = action;
}

// ── mini-markdown ─────────────────────────────────────────────────────────

function inline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`\n]+)`/g, (_m, code) => `<code>${code}</code>`);
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/\[([^\]\n]{1,120})\]\(([^)\s]{1,300})\)/g, (match, label, raw) => {
    const href = safeHref(raw.replace(/&amp;/g, '&'));
    return href ? `<a href="${href}" rel="noopener noreferrer nofollow" target="_blank">${label}</a>` : match;
  });
  html = html.replace(/(^|[\s(])(https?:\/\/[^\s<)\]]{5,240})/g, (match, head, raw) => {
    const href = safeHref(raw);
    return href ? `${head}<a href="${href}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(raw)}</a>` : match;
  });
  return html;
}

function renderBody(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = [];
  let quote = [];
  let fence = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    out.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = [];
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
    quote = [];
  };
  const flushAll = () => { flushParagraph(); flushList(); flushQuote(); };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (fence !== null) {
      if (line.trim() === '```') {
        out.push(`<pre>${escapeHtml(fence.join('\n'))}</pre>`);
        fence = null;
      } else fence.push(line);
      continue;
    }
    if (line.trim() === '```') { flushAll(); fence = []; continue; }
    if (line.trim() === '') { flushAll(); continue; }

    const heading = /^(#{1,3})\s+(.{1,120})$/.exec(line.trim());
    if (heading) { flushAll(); const level = heading[1].length + 1; out.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    const bullet = /^[-•]\s+(.{1,600})$/.exec(line.trim());
    if (bullet) { flushParagraph(); flushQuote(); list.push(bullet[1]); continue; }
    const quoted = /^>\s?(.{1,600})$/.exec(line.trim());
    if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); continue; }
    paragraph.push(line);
  }
  flushAll();
  if (fence !== null) out.push(`<pre>${escapeHtml(fence.join('\n'))}</pre>`);
  return out.join('');
}

// ── HTTP ──────────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    method: options.method || 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const error = new Error(friendlyError(payload?.error));
    error.code = payload?.error || `http_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return payload;
}

const state = { board: null, me: null };

// ── сессия в навигации ────────────────────────────────────────────────────

function renderSession(me) {
  state.me = me;
  const slot = document.getElementById('session-slot');
  if (!me) {
    slot.innerHTML = '<button class="p-navgroup-link" type="button" data-action="login">Вход</button>'
      + '<button class="p-navgroup-link p-navgroup-link--register" type="button" data-action="register">Регистрация</button>';
    return;
  }
  slot.innerHTML = `${avatarOf(me.username)}`
    + `<span class="p-account-who">${escapeHtml(me.username)}</span>`
    + `<span class="p-account-role">${escapeHtml(ROLE_LABEL[me.role] || 'Игрок')}</span>`
    + '<button class="p-navgroup-link" type="button" data-action="logout">Выйти</button>';
}

// ── боковая колонка ───────────────────────────────────────────────────────

function renderSidebar(stats, latest) {
  const sidebar = document.getElementById('sidebar');
  if (!stats) { sidebar.innerHTML = ''; return; }

  const latestRows = (latest || []).slice(0, 8).map((item) => `<li>
      ${avatarOf(item.author_name)}
      <div>
        <a class="row-title" href="#/topic/${item.topic_id}#post-${item.floor}">${escapeHtml(item.topic_title)}</a>
        <span class="row-meta">${escapeHtml(item.author_name)} · ${fmtDate(item.created_at)}</span>
      </div>
    </li>`).join('');

  sidebar.innerHTML = `
    ${latestRows ? `<div class="block"><div class="block-container">
      <h3 class="block-minorHeader">Последние сообщения</h3>
      <ul class="sideList">${latestRows}</ul>
      <div class="block-footer"><a href="#/latest">Все новые сообщения</a></div>
    </div></div>` : ''}
    <div class="block"><div class="block-container">
      <h3 class="block-minorHeader">Как попасть в игру</h3>
      <div class="block-body startBox">
        <div>1. Скачай клиент из раздела <a href="#/forum/skachat-klient">«Скачать клиент»</a>.</div>
        <div>2. Зайди в <a href="https://discord.gg/R3mr4DkHP" rel="noopener noreferrer nofollow" target="_blank">Discord</a>, там выдача и поддержка.</div>
        <div>3. В игре: <code>/reg</code> → <code>/login</code>.</div>
        <div class="serverLine">80.242.59.112:4141 · 50 слотов</div>
      </div>
    </div></div>
    <div class="block"><div class="block-container">
      <h3 class="block-minorHeader">Статистика</h3>
      <ul class="statsList">
        <li><span>Темы</span><b>${num(stats.topic_count)}</b></li>
        <li><span>Сообщения</span><b>${num(stats.post_count)}</b></li>
        <li><span>Игроки</span><b>${num(stats.member_count)}</b></li>
        <li><span>Новый аккаунт</span><b>${stats.newest_member ? escapeHtml(stats.newest_member) : '—'}</b></li>
        <li><span>Активность</span><b>${stats.last_post_at ? fmtDate(stats.last_post_at) : '—'}</b></li>
      </ul>
    </div></div>
    <div class="block"><div class="block-container">
      <h3 class="block-minorHeader">Правила форума</h3>
      <ul class="sideList">
        <li>${avatarOf('П')}<div><a class="row-title" href="#/forum/pravila">Общие правила</a>
          <span class="row-meta">Один игрок — один аккаунт на форуме.</span></div></li>
        <li class="is-plain"><span class="row-meta">Жалобы и апелляции — только в специальных разделах.</span></li>
        <li class="is-plain"><span class="row-meta">Данные входа в игру и админ-пароли не публикуем.</span></li>
      </ul>
    </div></div>`;
}

// ── карточки разделов ─────────────────────────────────────────────────────

function lastTopicCell(topic) {
  if (!topic) return '<div class="node-latest is-empty"><span>Пока пусто</span></div>';
  return `<div class="node-latest">
    ${avatarOf(topic.last_poster_name)}
    <div>
      <a class="latest-title" href="#/topic/${topic.id}">${escapeHtml(topic.title)}</a>
      <span class="latest-meta">${escapeHtml(topic.last_poster_name)} · ${fmtDate(topic.last_post_at)}</span>
    </div>
  </div>`;
}

function nodeStatsCell(primary, secondary) {
  return `<div class="node-stats">
    <dl class="pairs"><dt>${primary[0]}</dt><dd>${num(primary[1])}</dd></dl>
    <dl class="pairs"><dt>${secondary[0]}</dt><dd>${num(secondary[1])}</dd></dl>
  </div>`;
}

function forumRow(forum) {
  const icon = `<div class="node-icon"><span>${svgIcon(pickIcon(forum))}</span></div>`;
  if (forum.external_url) {
    const href = safeHref(forum.external_url);
    return `<div class="node node--external">
      ${icon}
      <div class="node-main">
        <h3 class="node-title"><a href="${href || '#'}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(forum.title)}</a></h3>
        <div class="node-description">${escapeHtml(forum.description)}</div>
      </div>
      <div class="node-stats"><span class="muted">ссылка</span></div>
      <div class="node-latest is-empty"><span>—</span></div>
    </div>`;
  }
  const restricted = forum.read_role !== 'guest'
    ? `<span class="label label--lock">роль: ${escapeHtml(forum.read_role)}</span>` : '';
  return `<div class="node">
    ${icon}
    <div class="node-main">
      <h3 class="node-title"><a href="#/forum/${forum.id}">${escapeHtml(forum.title)}</a></h3>
      <div class="node-description">${escapeHtml(forum.description)} ${restricted}</div>
    </div>
    ${nodeStatsCell(['Темы', forum.topic_count], ['Сообщения', forum.post_count])}
    ${lastTopicCell(forum.last_topic)}
  </div>`;
}

function viewBoard(board) {
  setCrumbs('');
  setPageTitle('Форумы', '', board.me
    ? '<button class="button button--primary" data-action="new-topic">Начать обсуждение</button>' : '');
  return board.categories.map((category) => {
    const rows = category.forums.map(forumRow).join('');
    return `<div class="block block--category">
      <div class="block-container">
        <h2 class="block-header">${escapeHtml(category.title)}</h2>
        <div class="block-body">${rows || '<div class="blockMessage">В категории пока нет разделов.</div>'}</div>
      </div>
      <div class="block-outer"></div>
    </div>`;
  }).join('') || '<div class="blockMessage">Разделы ещё не созданы.</div>';
}

function pager(page, hasMore, base) {
  const parts = [];
  if (page > 1) parts.push(`<a href="${base}&page=${page - 1}">← Назад</a>`);
  parts.push(`<span class="now">${page}</span>`);
  if (hasMore) parts.push(`<a href="${base}&page=${page + 1}">Вперёд →</a>`);
  return `<div class="pager">${parts.join('')}</div>`;
}

const PREFIX_CLASS = {
  'ОТКРЫТО': 'open', 'ЗАКРЕПЛЕНО': 'pin', 'РЕШЕНО': 'open', 'ВАЖНО': 'brand', 'АНОНС': 'pin',
};

function prefixBadges(topic) {
  const out = [];
  if (topic.prefix) out.push(`<span class="label label--${PREFIX_CLASS[topic.prefix] || 'plain'}">${escapeHtml(topic.prefix)}</span>`);
  if (topic.is_pinned) out.push('<span class="label label--pin">Закреплено</span>');
  if (topic.is_locked) out.push('<span class="label label--lock">Закрыто</span>');
  return out.join('');
}

function structStatsCell(pairs) {
  return `<div class="structItem-cell structItem-cell--stats">${pairs
    .map(([label, value]) => `<dl class="pairs"><dt>${label}</dt><dd>${num(value)}</dd></dl>`).join('')}</div>`;
}

function latestCell(name, when, href) {
  return `<div class="structItem-cell structItem-cell--latest">
    ${avatarOf(name)}
    <div>
      <a class="structItem-latestName" href="${href}">${escapeHtml(name)}</a>
      <span class="structItem-latestTime">${fmtDate(when)}</span>
    </div>
  </div>`;
}

function threadRow(topic) {
  return `<div class="structItem structItem--thread${topic.is_pinned ? ' is-sticky' : ''}">
    <div class="structItem-cell structItem-cell--main">
      ${avatarOf(topic.author_name)}
      <div>
        <h3 class="structItem-title">${prefixBadges(topic)}<a href="#/topic/${topic.id}">${escapeHtml(topic.title)}</a></h3>
        <div class="structItem-parts">${escapeHtml(topic.author_name)} · ${fmtDate(topic.created_at)}</div>
      </div>
    </div>
    ${structStatsCell([['Ответы', topic.replies]])}
    ${structStatsCell([['Просмотры', topic.views]])}
    ${latestCell(topic.last_poster_name, topic.last_post_at, `#/topic/${topic.id}`)}
  </div>`;
}

function dataListHeader(columns) {
  return `<div class="dataList-header">${columns.map(([label, cls]) =>
    `<div class="structItem-cell structItem-cell--${cls}">${label}</div>`).join('')}</div>`;
}

function viewForum(data) {
  setCrumbs(`<span class="crumb-sep">›</span><a href="#/forum/${data.forum.id}">${escapeHtml(data.forum.title)}</a>`);
  const action = data.can_write
    ? `<button class="button button--primary" data-action="new-topic" data-forum="${data.forum.id}">Начать обсуждение</button>`
    : `<span class="muted">${data.forum.read_role !== 'guest' ? 'Раздел для персонала' : 'Нужна регистрация'}</span>`;
  setPageTitle(escapeHtml(data.forum.title), '', action);

  const rows = data.topics.map(threadRow).join('');
  return `<div class="block block--list">
    <div class="block-container">
      <div class="block-filterBar"><span class="block-desc">${escapeHtml(data.forum.description)}</span></div>
      ${dataListHeader([['Тема', 'main'], ['Ответы', 'stats'], ['Просмотры', 'views'], ['Последнее действие', 'latest']])}
      <div class="block-body">${rows || '<div class="blockMessage">В разделе пока нет тем.</div>'}</div>
    </div>
    <div class="block-outer block-outer--split">
      <span class="block-outer-main">${pager(data.page, data.has_more, `#/forum/${data.forum.id}?`)}</span>
    </div>
  </div>`;
}

function viewTopic(data) {
  setCrumbs(`<span class="crumb-sep">›</span><a href="#/forum/${data.forum.id}">${escapeHtml(data.forum.title)}</a>`
    + `<span class="crumb-sep">›</span>${escapeHtml(data.topic.title)}`);
  const pages = Math.max(1, Math.ceil(data.total_posts / data.posts_per_page));
  setPageTitle(escapeHtml(data.topic.title), prefixBadges(data.topic), '');

  const posts = data.posts.map((post) => `<article class="message message--post" id="post-${post.floor}">
      <div class="message-userCol">
        ${avatarOf(post.author_name, 'avatar--m')}
        <div class="message-userName">${escapeHtml(post.author_name)}</div>
        <div class="message-userRole">${escapeHtml(ROLE_LABEL[post.author_role] || 'Игрок')}</div>
      </div>
      <div class="message-content">
        <div class="message-attribution">
          <span>${fmtDate(post.created_at)}${post.edited_at ? ' · изменено' : ''}</span>
          <a href="#/topic/${data.topic.id}#post-${post.floor}">#${post.floor}</a>
        </div>
        <div class="bbWrapper">${renderBody(post.body)}</div>
        ${data.can_moderate && post.floor === 1 ? `<div class="message-actions">
            <button class="button button--plain" data-action="pin" data-id="${data.topic.id}" data-on="${!data.topic.is_pinned}">${data.topic.is_pinned ? 'Открепить' : 'Закрепить'}</button>
            <button class="button button--plain" data-action="lock" data-id="${data.topic.id}" data-on="${!data.topic.is_locked}">${data.topic.is_locked ? 'Открыть' : 'Закрыть'}</button>
            <button class="button button--plain" data-action="delete" data-id="${data.topic.id}">Удалить тему</button>
          </div>` : ''}
      </div>
    </article>`).join('');

  const reply = data.can_reply ? `<form class="replyBox" id="reply-form">
      <h2>Ответить</h2>
      <label class="field"><span>Сообщение</span><textarea id="reply-body" rows="6" maxlength="6000" required></textarea></label>
      <p class="hint">Поддерживается: <code># заголовок</code>, <code>**жирный**</code>, <code>*курсив*</code>, <code>- список</code>, <code>\`код\`</code>, ссылки.</p>
      <p class="form-error" id="reply-error"></p>
      <button class="button button--primary" type="submit">Отправить</button>
    </form>`
    : `<div class="notice">${data.topic.is_locked ? 'Тема закрыта — ответы недоступны.' : 'Чтобы отвечать, войди или зарегистрируйся.'}</div>`;

  const meta = `${data.topic.replies} ${plural(data.topic.replies, 'ответ', 'ответа', 'ответов')} · ${num(data.topic.views)} ${plural(data.topic.views, 'просмотр', 'просмотра', 'просмотров')}`;
  return `<div class="block block--messages">
    <div class="block-container">
      <div class="block-outer block-outer--split block-outer--inside">
        <span class="block-outer-main">${pager(data.page, data.page * data.posts_per_page < data.total_posts, `#/topic/${data.topic.id}?`)}</span>
        <span class="block-outer-opposite muted">${meta} · страница ${data.page} из ${pages}</span>
      </div>
      <div class="block-body messageList">${posts || '<div class="blockMessage">Сообщения не найдены.</div>'}</div>
    </div>
    ${reply}</div>`;
}

function viewLatest(data) {
  setCrumbs('<span class="crumb-sep">›</span>Что нового');
  setPageTitle('Что нового', '', '');
  const rows = data.items.map((item) => `<div class="structItem structItem--message">
      <div class="structItem-cell structItem-cell--main">
        ${avatarOf(item.author_name)}
        <div>
          <h3 class="structItem-title"><a href="#/topic/${item.topic_id}#post-${item.floor}">${escapeHtml(item.topic_title)}</a></h3>
          <div class="structItem-parts"><a href="#/forum/${item.forum_id}">${escapeHtml(item.forum_title)}</a> · ${escapeHtml(item.author_name)}</div>
          <div class="structItem-excerpt">${escapeHtml(item.excerpt)}${item.excerpt.length >= 180 ? '…' : ''}</div>
        </div>
      </div>
      ${structStatsCell([['Этаж', item.floor]])}
      <div class="structItem-cell structItem-cell--latest">
        <div>
          <span class="structItem-latestTime">${fmtDate(item.created_at)}</span>
        </div>
      </div>
    </div>`).join('');

  return `<div class="block block--list">
    <div class="block-container">
      ${dataListHeader([['Тема', 'main'], ['Этаж', 'stats'], ['Когда', 'latest']])}
      <div class="block-body">${rows || '<div class="blockMessage">Свежих сообщений нет.</div>'}</div>
    </div>
    <div class="block-outer block-outer--split">
      <span class="block-outer-main">${pager(data.page, data.has_more, '#/latest?')}</span>
    </div>
  </div>`;
}

function viewSearch(data) {
  setCrumbs(`<span class="crumb-sep">›</span>Поиск: ${escapeHtml(data.query)}`);
  setPageTitle(`Поиск: ${escapeHtml(data.query)}`, '', '');
  const rows = data.items.map((topic) => `<div class="structItem structItem--thread">
      <div class="structItem-cell structItem-cell--main">
        ${avatarOf(topic.author_name)}
        <div>
          <h3 class="structItem-title">${prefixBadges(topic)}<a href="#/topic/${topic.id}">${escapeHtml(topic.title)}</a></h3>
          <div class="structItem-parts"><a href="#/forum/${topic.forum_id}">${escapeHtml(topic.forum_title)}</a> · ${escapeHtml(topic.author_name)}</div>
        </div>
      </div>
      ${structStatsCell([['Ответы', topic.replies]])}
      ${latestCell(topic.author_name, topic.last_post_at, `#/topic/${topic.id}`)}
    </div>`).join('');

  return `<div class="block block--list">
    <div class="block-container">
      <div class="block-filterBar"><span class="block-desc">Совпадений: ${data.items.length}. Ищем по заголовкам свежих ${data.scanned} тем.</span></div>
      ${dataListHeader([['Тема', 'main'], ['Ответы', 'stats'], ['Последнее действие', 'latest']])}
      <div class="block-body">${rows || '<div class="blockMessage">Ничего не найдено. Попробуй другое слово.</div>'}</div>
    </div>
  </div>`;
}

// ── роутер ────────────────────────────────────────────────────────────────

function parseHash() {
  // Хэш вида #/topic/<uuid>?page=2#post-7: ссылку на конкретный этаж носим во втором фрагменте.
  const raw = location.hash.replace(/^#\/?/, '');
  const [location_, anchor = ''] = raw.split('#');
  const [path, query = ''] = location_.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, params: new URLSearchParams(query), anchor };
}

let token = 0;

async function ensureBoard() {
  if (!state.board) state.board = await api('/board');
  return state.board;
}

async function route() {
  const myToken = ++token;
  const { parts, params, anchor } = parseHash();
  const view = document.getElementById('view');
  const page = params.get('page') || '1';
  document.querySelectorAll('.p-nav-link').forEach((link) => {
    const isBoard = parts.length === 0 && link.dataset.tab === 'board';
    link.classList.toggle('is-selected', isBoard || link.dataset.tab === parts[0]);
  });

  try {
    if (parts.length === 0) {
      const board = await api('/board');
      if (myToken !== token) return;
      state.board = board;
      renderSession(board.me);
      let latest = [];
      try {
        const feed = await api('/latest?page=1');
        if (myToken !== token) return;
        latest = feed.items;
      } catch { /* статистика важнее ленты */ }
      renderSidebar(board.stats, latest);
      view.innerHTML = viewBoard(board);
    } else if (parts[0] === 'forum' || parts[0] === 'node') {
      await ensureBoard();
      const id = resolveForumId(parts[1]);
      if (!id) {
        setPageTitle('Раздел не найден', '', '');
        view.innerHTML = '<div class="blockMessage">Раздел не найден. Проверь ссылку.</div>';
        return;
      }
      const data = await api(`/forum?id=${encodeURIComponent(id)}&page=${encodeURIComponent(page)}`);
      if (myToken !== token) return;
      renderSession(data.me);
      renderSidebar(state.board.stats);
      view.innerHTML = viewForum(data);
    } else if (parts[0] === 'topic') {
      const [data] = await Promise.all([
        api(`/topic?id=${encodeURIComponent(parts[1])}&page=${encodeURIComponent(page)}`),
        ensureBoard(),
      ]);
      if (myToken !== token) return;
      renderSession(data.me);
      renderSidebar(state.board?.stats);
      view.innerHTML = viewTopic(data);
      const form = document.getElementById('reply-form');
      if (form) form.addEventListener('submit', submitReply(data));
    } else if (parts[0] === 'latest') {
      const data = await api(`/latest?page=${encodeURIComponent(page)}`);
      if (myToken !== token) return;
      renderSession(data.me);
      await ensureBoard();
      renderSidebar(state.board?.stats, data.items);
      view.innerHTML = viewLatest(data);
    } else if (parts[0] === 'search') {
      const query = params.get('q') || '';
      if (query.trim().length < 2) {
        setPageTitle('Поиск', '', '');
        view.innerHTML = '<div class="blockMessage">Введи минимум 2 символа.</div>';
        return;
      }
      const [data] = await Promise.all([
        api(`/search?q=${encodeURIComponent(query)}`),
        ensureBoard(),
      ]);
      if (myToken !== token) return;
      renderSession(data.me);
      renderSidebar(state.board?.stats);
      view.innerHTML = viewSearch(data);
    } else {
      setPageTitle('Страница не найдена', '', '');
      view.innerHTML = '<div class="blockMessage">Такой страницы нет.</div>';
    }
    const target = anchor ? document.getElementById(anchor) : null;
    if (target) target.scrollIntoView({ block: 'center' });
    else window.scrollTo({ top: 0 });
  } catch (error) {
    if (myToken !== token) return;
    view.innerHTML = `<div class="blockMessage">${escapeHtml(error.message || 'Ошибка загрузки')}</div>`;
    if (error.code === 'unauthenticated') openAuth('login');
  }
}

function resolveForumId(value) {
  if (!value) return null;
  if (/^[0-9a-f-]{36}$/i.test(value)) return value;
  if (!state.board) return null;
  for (const category of state.board.categories) {
    const hit = category.forums.find((forum) => forum.slug === value);
    if (hit) return hit.id;
  }
  return null;
}

// ── диалоги: вход, регистрация, новая тема ────────────────────────────────

const authDialog = document.getElementById('auth-dialog');
const composeDialog = document.getElementById('compose-dialog');
let authMode = 'login';

function openAuth(mode) {
  authMode = mode;
  document.getElementById('auth-title').textContent = mode === 'register' ? 'Регистрация' : 'Вход';
  document.getElementById('auth-submit').textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';
  document.getElementById('auth-hint').textContent = mode === 'register'
    ? 'Ник — как в игре или свой собственный; пароль не менее 8 символов. Аккаунт форума не связан с игровой базой.'
    : 'Сессия живёт 30 дней на этом браузере.';
  document.getElementById('auth-password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  document.getElementById('auth-error').textContent = '';
  authDialog.showModal();
  document.getElementById('auth-username').focus();
}

function writeableForums() {
  return (state.board?.categories || []).flatMap((category) => category.forums)
    .filter((forum) => !forum.external_url && forum.write_role === 'member');
}

function openCompose(forumId) {
  document.getElementById('compose-error').textContent = '';
  const forumSelect = document.getElementById('compose-forum');
  const forumWrap = document.getElementById('compose-forum-wrap');
  const prefixSelect = document.getElementById('compose-prefix');
  const prefixWrap = document.getElementById('compose-prefix-wrap');

  const chosen = forumId ? resolveForumId(forumId) : null;
  if (forumId && !chosen) { toast('Раздел не найден', true); return; }

  const options = writeableForums();
  if (chosen) {
    forumWrap.hidden = true;
    forumSelect.innerHTML = `<option value="${chosen}">${escapeHtml(nameOfForum(chosen))}</option>`;
  } else {
    forumWrap.hidden = false;
    forumSelect.innerHTML = options
      .map((forum) => `<option value="${forum.id}">${escapeHtml(forum.title)}</option>`).join('');
  }
  syncPrefixes(prefixSelect, prefixWrap, forumSelect.value);
  forumSelect.onchange = () => syncPrefixes(prefixSelect, prefixWrap, forumSelect.value);

  composeDialog.showModal();
  document.getElementById('compose-topic').focus();
}

function allForums() {
  return (state.board?.categories || []).flatMap((category) => category.forums);
}

function syncPrefixes(prefixSelect, prefixWrap, forumId) {
  const forum = allForums().find((candidate) => candidate.id === forumId);
  const prefixes = (Array.isArray(forum?.prefixes) ? forum.prefixes : []).filter((value) => typeof value === 'string' && value);
  prefixWrap.hidden = prefixes.length === 0;
  prefixSelect.innerHTML = '<option value="">без префикса</option>'
    + prefixes.map((prefix) => `<option value="${escapeHtml(prefix)}">${escapeHtml(prefix)}</option>`).join('');
}

function nameOfForum(id) {
  return allForums().find((candidate) => candidate.id === id)?.title || 'Раздел';
}

async function submitReply(data) {
  return async (event) => {
    event.preventDefault();
    const body = document.getElementById('reply-body').value;
    const errorBox = document.getElementById('reply-error');
    const button = event.target.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const created = await api('/reply', { method: 'POST', body: { topic_id: data.topic.id, body } });
      toast('Ответ опубликован');
      const floor = created.post.floor;
      const page = Math.min(500, Math.max(1, Math.ceil(floor / data.posts_per_page)));
      location.hash = `#/topic/${data.topic.id}?page=${page}#post-${floor}`;
      route();
    } catch (error) {
      errorBox.textContent = error.message;
      if (error.code === 'unauthenticated') openAuth('login');
    } finally { button.disabled = false; }
  };
}

// ── обработчики кликов ────────────────────────────────────────────────────

document.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const action = trigger.dataset.action;

  if (action === 'login') { openAuth('login'); return; }
  if (action === 'register') { openAuth('register'); return; }
  if (action === 'new-topic') {
    if (!state.me) { openAuth('login'); return; }
    openCompose(trigger.dataset.forum);
    return;
  }
  if (action === 'logout') {
    trigger.disabled = true;
    try { await api('/logout', { method: 'POST', body: {} }); state.board = null; await route(); toast('Вы вышли'); }
    catch (error) { toast(error.message, true); }
    finally { trigger.disabled = false; }
    return;
  }
  if (['pin', 'lock', 'delete'].includes(action)) {
    const map = { pin: 'pin', lock: 'lock', delete: 'delete_topic' };
    if (action === 'delete' && !confirm('Удалить тему? Её не видно будет игрокам.')) return;
    trigger.disabled = true;
    try {
      await api('/moderate', { method: 'POST', body: { action: map[action], topic_id: trigger.dataset.id } });
      toast('Готово');
      route();
    } catch (error) { toast(error.message, true); trigger.disabled = false; }
  }
});

document.getElementById('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('auth-error');
  const button = document.getElementById('auth-submit');
  errorBox.textContent = '';
  button.disabled = true;
  try {
    const payload = {
      username: document.getElementById('auth-username').value,
      password: document.getElementById('auth-password').value,
    };
    const data = await api(authMode === 'register' ? '/register' : '/login', { method: 'POST', body: payload });
    renderSession(data.me);
    state.board = null;
    authDialog.close();
    toast(authMode === 'register' ? 'Аккаунт создан' : `Привет, ${data.me.username}`);
    route();
  } catch (error) {
    errorBox.textContent = error.message;
  } finally { button.disabled = false; }
});

document.getElementById('compose-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('compose-error');
  const button = document.getElementById('compose-submit');
  errorBox.textContent = '';
  const payload = {
    forum_id: document.getElementById('compose-forum').value,
    title: document.getElementById('compose-topic').value,
    body: document.getElementById('compose-body').value,
    prefix: document.getElementById('compose-prefix').value,
  };
  if (!payload.forum_id) { errorBox.textContent = 'Не выбран раздел.'; return; }
  button.disabled = true;
  try {
    const data = await api('/topic/create', { method: 'POST', body: payload });
    composeDialog.close();
    document.getElementById('compose-topic').value = '';
    document.getElementById('compose-body').value = '';
    toast('Тема опубликована');
    location.hash = `#/topic/${data.topic_id}`;
    route();
  } catch (error) {
    errorBox.textContent = error.message;
    if (error.code === 'unauthenticated') { composeDialog.close(); openAuth('login'); }
  } finally { button.disabled = false; }
});

document.getElementById('auth-cancel').addEventListener('click', () => authDialog.close());
document.getElementById('compose-cancel').addEventListener('click', () => composeDialog.close());

document.getElementById('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = document.getElementById('search-input').value.trim();
  if (value.length < 2) { toast('Минимум 2 символа', true); return; }
  location.hash = `#/search?q=${encodeURIComponent(value)}`;
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('premaze-theme', next);
});

const savedTheme = localStorage.getItem('premaze-theme');
if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';

window.addEventListener('hashchange', route);
route();
