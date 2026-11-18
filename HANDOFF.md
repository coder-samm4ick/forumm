# Форум Premazing — опубликован и работает, состояние на 2026-11-06 (вечер)

Заказ: форум для проекта **Premazing** (SA-MP 0.3.7, один сервер **White**) как https://forum.amazing-online.com/ — тот движок **XenForo 2**, структура скопирована с него, но наполнение своё.

**Живой адрес: https://premaze-forum-m2ds0hqr30a.qoder.website** — доступ `public`, регистрация открыта, контент боевой (не демо).

## Решения, которые он уже дал (не переспрашивать)
1. Хостинг — **Qoder Sites**, публикацию делает агент, отдать живой URL. Сделано.
2. Аккаунты — **отдельная регистрация на форуме** (ник/пароль), игровую MySQL-базу не трогаем. Сделано.
3. Разделы — **как у AMAZING, но Premazing и только один сервер White**, без разделов фракций. Сделано.
4. Шапка — «сгенерировать арт» → ImageGen отдал 403 (квота, код 112). Замена: векторный баннер SVG (багровый→оранжевый, силуэт города, вордмарк PREMAZING). Арт не генерировать повторно, пока не скажет.
5. **Remazing занято** → проект **Premazing**, переименование «везде, где успею». Закрыто: форум (код, тексты, cookie `__Host-pmf.session`, сайт/проект/хост), `discord\Premazing-discord-pack.md`, `discord-bot\premaze-discord-bot.mjs`, `remazing-discord-bot.zip` → `premaze-discord-bot.zip`, `remazing-3d` → `premaze-3d` (+ name в package.json и в node_modules-локе). Отдельно стоящих «remazing» в этих папках не осталось.

## Облако (не создавать второе)
- `projectId 01a1b106-7405-778f-92d3-8b9cf73c9460`, `siteId 01a1b106-7406-78af-86ae-ea06d4052489`, хост `premaze-forum-m2ds0hqr30a.qoder.website`.
- Backend `database + functions + storage`, `databaseAccessModel: function_backend` (операция `01a1b108-5025-7734-870a-2e582b506aee`).
- Миграция `premaze-forum-schema-v3` = `01a1b118-a122-7955-9bf5-f85279e12ad7`, состояние **applied**: 7 таблиц, 5 индексов; политики платформа выдала сама (`authenticated`/`function_backend`), `accessPolicies: []`.
- Опубликованный draft: **`actionId ce40620b-a981-4f90-b85a-59ce99528105`** (фронт в стиле AMAZING; предшествующие `e84fa088-…`, `7aecddce-…`, `c282d467-…` — история, не публиковать). Descriptor: `.Premazing — форум.qoder.site`.
- Входы prepare, которые прошли: `projectRoot` = папка форума, `webDirectory: "web"`, `functionDirectory: "functions"`, `databaseAccess: "read_write"`, `schemaRef` из свежего `get_database_schema` (чтение отдаёт `stale: true` — это нормально, schemaRef годится), `projectId` существующий, `secretNames` не нужен (у функции `required_secret_names: []`).
- Доступ был `private` — переключён в `public` (`update_access_policy`, mode public, confirmPublic).

## ⚠️ Ловушки платформы (закрыты, но помнить)
1. **Валидатор DDL отвергает колонку с именем `position`** — `unsupported_ddl` без слова «position», четыре отказа подряд были впустую. Изоляция пробами: `key`, `floor`, `role`, `prefix`, `body`, `prefixes`, `external_url`, `revoked_at` проходят; `position` — нет. Порядок узлов теперь `sort_order` (наружу в API не выходит). Имя индекса с «position» разрешено; `CREATE INDEX ... (sort_order)` — да.
2. После первой миграции `get_database_schema` ≥2 минуты отдаёт `sites_database_not_ready` (у `query_database_rows` — `sites_database_catalog_not_ready`). Лечится документированно: `get_database_schema` c `refresh: true` + `requestId` → дождаться операции → читать. Без этого нет `schemaRef` и `prepare_site` не собрать.
3. `prepare_site` draft-а с БД требует `schemaRef` из свежего чтения и `projectId`; при `descriptorStatus: "pending"` — поллить операцию и повторить **тем же** `actionId` и теми же параметрами.
4. `FALLBACK_ORIGINS` в `functions\http.mjs` случайно совпал с фактическим `site.host`; проверено живыми POST — `origin_forbidden` нет. Менять не нужно, запасной вариант — `APP_ORIGIN`.

## Что в коде (всё в `space\premaze-forum\`)
- `schema\forum.sql` — users, sessions, auth_limiter, categories, forums, topics, posts + индексы.
- `functions\http.mjs` — ошибки, bounded JSON, разбор пути, проверка Origin.
- `functions\security.mjs` — PBKDF2-HMAC-SHA256 300k, cookie `__Host-pmf.session` (30 дней, HttpOnly/Secure/Lax; в БД только SHA-256 от токена), роли guest/member/helper/admin/dev, лимитер login 10/15m, register 5/1h, topic 8/30m, reply 20/10m (CAS по `auth_limiter`).
- `functions\content.mjs` — `ensureStructure()`: **6 категорий, 26 разделов** (2 служебных `read_role: helper`), **21 закреплённая стартовая тема** (19 видны гостю), детерминированные UUID → повторный сид не дублирует. Тексты из `space\discord\Premazing-discord-pack.md`.
- `functions\router.mjs` — `GET /api/board|forum|topic|latest|search|me`, `POST /api/register|login|logout|topic/create|reply|moderate`. Счётчики разделов — CAS (`bumpForum`), пол = 1 + ответы, удаление софт. Модерация: pin/unpin/lock/unlock (helper), delete/restore_topic (admin). Статистика считается **только по видимым зрителю разделам** и без служебного аккаунта сида.
- `functions\index.ts` — `createSiteContext(request, { forwardApplicationCredentials: true })` + `createDatabaseClient()` + `Deno.serve`; импорт только `./_qoder/backend.mjs` (платформа подставляет при деплое, не паковать).
- `web\` — XenForo-style SPA: hash-роуты `#/`, `#/forum/<id>`, `#/topic/<id>?page=N#post-F`, `#/latest`, `#/search?q=`; свой мини-маркдаун с экранированием и `rel="noopener noreferrer nofollow"`; светлая+тёмная тема (`premaze-theme`); «Новые сообщения», превью последней темы со статусом, статистика сбоку.
- `dev\fake-db.mjs` + `dev\forum.test.mjs` — офлайн-прогон настоящих маршрутов: `node --test dev/forum.test.mjs` из корня папки → **8/8** (на Windows `node --test dev/` не работает).

## Фронт в стиле AMAZING (2026-11-06, вечер, action `ce40620b`)

Заказ: «точь в точь как на оригинальном форуме amazing-online, только картинки Premazing». Мерки снимались с живого форума (XenForo 2) через `evaluate_script` + same-origin чтение `css.php` — **скриншот снять нельзя** (`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`), поэтому ориентируемся на измеренные значения, а они в CSS сидят:

- Полотна: фон `#f8f8f8`, панель `#fff`, границы `#f4f4f4`/`#e7e7e7`, текст `#2e2e2e`/`#6e6e6e`, иконка-круг `#f3f3f3` с чернильным `#707070`, тень `0 5px 50px -10px rgba(0,0,0,.1)`, радиус 3 px, контейнер 1200 px, шрифт Roboto (подключён с fonts.googleapis).
- Каркас: `header.p-header` — градиентная полоса 101° (бордо→багровый→оранжевый) с `clip-path`-силуэтом города и min-height 168 px, внутри вордмарк-PREMAZING (свой SVG), поиск и переключатель темы; ниже `nav.p-nav` — белые вкладки 50 px с 3 px активным подчёркиванием; затем `p-subnav` с хлебными крошками; баннер `promo.svg` (1171×200, своя векторная графика); `footer.p-footer` в 4 колонки.
- Списки разделов — не таблица, а «ноды»: круглая иконка 45 px (SVG-пиктограмма подбирается по slug/названию в `ICONS`/`ICON_BY_SLUG`), заголовок 17 px, описание, колонка счётчиков 140 px, колонка «последнее сообщение» 260 px, `hover: scale(1.01)`, отступы `0 35px`.
- Список тем/сообщений — `.dataList`/`.dataList-row`, сама тема — `.message` с аватаром 96 px (инициалы, без чужих картинок), пагинация в `.block-outer`, кнопка «Начать обсуждение» справа.
- Всё написано заново (свои классы, свои SVG, свои тексты) — ни одного файла/строки с оригинального форума.

Файлы: `web\index.html`, `web\styles.css`, `web\app.js`, `web\promo.svg`; до-рестайла — `backup\{index.html,styles.css,app.js}.pre-amzlook-2026-11-06`.
Бэкенд, схема, API, cookie — не тронуты. Важно: `/api/forum` **не отдаёт** `stats` (берём из кэшированного `/board`), `/api/topic` **не отдаёт** `is_deleted` у постов.

Проверка фронта офлайн: `node --test dev/render.smoke.mjs` → **8/8**. Он гоняет настоящий `web/app.js` в vm со стабом DOM и фикстурами `dev\_fix_*.json` (сняты curl'ом с живого сайта как гость) и ругается на `undefined`/`NaN`/`[object Object]` в разметке. Фикстуры — просто данные, их можно переснять.

## Живая проверка (на опубликованном сайте)
- Гость: 5 из 6 категорий и 24 раздела, статистика сходится с лентой (Темы 19 / Сообщения 19 / Новые сообщения 19), баннер SVG, ни одной 5xx в логах функций, 20–120 мс.
- Игрок: регистрация 201 → тема 201 → ответ floor 2; в закрытую тему 409; в раздел с `write_role: admin` без права 403; гостю в служебный раздел 403.
- Поднятие роли прямо в БД (`update_database_row` в `users.role`) применяется сразу на том же токене: pin/lock/unlock/unpin 200, «Служебное» появляется в дереве, `can_moderate` true.
- Тестовые строки (`ptest`, тема + 2 поста, сессия) удалены, счётчики «Курилки» возвращены к 0/0/null — БД ровно как после сида, «Игроки 0».
- После рестайла (action `ce40620b`), всё через `evaluate_script` на живой странице: 5 блоков-категорий, 24 ноды с SVG-иконками, `promo.svg` 200 OK, 4 боковых блока, 4 колонки футера, шрифт Roboto, `--canvas` = `rgb(248,248,248)`, ноль сообщений в консоли. Маршруты: `#/forum/pravila` → 1 строка dataList, тема → 1 `.message` + счётчик просмотров, `#/latest` → 19 строк. `app.js` и `styles.css` отдаются байт-в-байт как локальные.
- Ждём: **скриншот** — встроенный Browser без видимой поверхности (`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`), viewport 515×831, поэтому десктопная раскладка проверена только по CSSOM-значениям, а не глазами.
- `update_database_row` со смесью `integer` и `null` в одном вызове дважды вернул `state: "unknown"` и ничего не применил (чтение подтвердило). Разделённые вызовы прошли. Неизвестный результат — сначала прочитать, потом новый requestId.

## Что осталось
1. **Его аккаунт — есть.** Ник `Дима`, пароль в `OWNER_CREDENTIALS.txt`, роль `admin`; доступ к сайту переключён в `public`. Домен отдельный дать нельзя — Qoder Sites выдаёт только адрес вида `*.qoder.website`.
2. Ссылка на клиент-сборку в теме «Скачать клиент» — текстовый плейсхолдер, вставить самому (пути к раздаче у агента нет).
3. `server.cfg` всё ещё `hostname SA-MP 0.3 Server` / `weburl www.sa-mp.com` — в текст форума не выносим; форум говорит `80.242.59.112:4141` и «не в списке серверов». Нужен рестарт-окно, его решение.
4. В `space\` рядом: `discord-bot\` (готов, залит в Discord) и `upload-2026-11-06\new.amx` (деплой мода).
