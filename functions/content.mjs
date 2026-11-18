// Структура форума Premazing и закрепленные стартовые темы.
// Это конфигурация приложения, а не демо-данные: Function досоздаёт её один раз,
// если база пуста (стабильные UUID → повторный запуск ничего не дублирует).
import { rows } from './http.mjs';

const BUG_PREFIXES = ['Баг', 'Дубликат', 'В работе', 'Исправлено'];
const CLAIM_PREFIXES = ['Открыто', 'В работе', 'Решено', 'Отказано'];
const NONE = [];

export const STRUCTURE = [
  {
    slug: 'vazhnyye-ssylki', title: 'Важные ссылки', forums: [
      {
        slug: 'discord-servera', title: 'Discord-сервер Premazing',
        description: 'Общение, озвон, набор в команду. Быстрее всего отвечать там.',
        external_url: 'https://discord.gg/R3mr4DkHP',
      },
      {
        slug: 'kabinet-avtozvuk', title: 'Кабинет «Автозвук»',
        description: 'Загрузка треков для внутриигрового плеера /player.',
        external_url: 'https://avtozvuk-m2ds0hqr30a.qoder.website',
      },
      {
        slug: 'pravila', title: 'Правила игры и форума', description: 'Действующая редакция. Обсуждение — в отдельных ветках.',
        read_role: 'guest', write_role: 'admin', prefixes: NONE,
      },
      {
        slug: 'kak-zaiti', title: 'Как зайти на сервер', description: 'White не в общем списке — адрес добавляется вручную.',
        read_role: 'guest', write_role: 'admin', prefixes: NONE,
      },
      {
        slug: 'skachat-klient', title: 'Скачать клиент', description: 'Состав CEF-сборки и порядок установки.',
        read_role: 'guest', write_role: 'admin', prefixes: NONE,
      },
    ],
  },
  {
    slug: 'tekhnicheskii-razdel', title: 'Технический раздел', forums: [
      {
        slug: 'pravila-tekhnicheskogo-razdela', title: 'Правила раздела и технические правила игры',
        description: 'Что считается недоработкой и какие пруфы принимаются.',
        read_role: 'guest', write_role: 'admin', prefixes: NONE,
      },
      { slug: 'problemy-s-donatom', title: 'Проблемы с донатом', description: 'Не пришла покупка, списалось дважды, ошибка оплаты.', prefixes: ['Вопрос', 'Жду выдачу', 'Решено', 'Отказано'] },
      { slug: 'nedorabotki-moda', title: 'Недоработки игрового мода', description: 'Скрипты, команды, интерфейсы, экономика.', prefixes: BUG_PREFIXES },
      { slug: 'nedorabotki-ts', title: 'Недоработки транспортных средств', description: 'Салон, физика, угон, тюнинг, спавн.', prefixes: BUG_PREFIXES },
      { slug: 'nedorabotki-modelei', title: 'Недоработки моделей и скинов', description: 'Текстуры, проплеверы, анимации, звуки.', prefixes: BUG_PREFIXES },
      { slug: 'nedorabotki-karty', title: 'Недоработки карты и объектов', description: 'Интерьеры, дома, бизнесы, невидимые стены.', prefixes: BUG_PREFIXES },
      { slug: 'nedorabotki-saita', title: 'Недоработки сайта и лаунчера', description: 'Форум, кабинет, загрузка клиента.', prefixes: BUG_PREFIXES },
      { slug: 'vosstanovleniye-dostupa', title: 'Восстановление доступа к аккаунту', description: 'Сменник, утерянный ник, доступ к почте.', prefixes: ['Запрос', 'Выдано', 'Отказано'] },
      { slug: 'igrovoye-zakonodatel-stvo', title: 'Игровое законодательство', description: 'Уставы, приказы и разъяснения по RP-нормам.', read_role: 'guest', write_role: 'admin', prefixes: NONE },
    ],
  },
  {
    slug: 'igrovoy-server-white', title: 'Игровой сервер White', forums: [
      { slug: 'novosti-i-obnovleniya', title: 'Новости и обновления', description: 'Анонсы, патчноуты, технические работы.', read_role: 'guest', write_role: 'admin', prefixes: ['Анонс', 'Обновление', 'Тех. работы'] },
      { slug: 'obsuzhdenie-servera', title: 'Обсуждение сервера', description: 'Впечатления, баланс, вопросы по геймплею.', prefixes: ['Вопрос', 'Обсуждение'] },
      { slug: 'skriny-i-klipy', title: 'Скриншоты и клипы', description: 'Кадры с сервера и монтажи по White.', prefixes: NONE },
      { slug: 'sotrudnichestvo', title: 'Сотрудничество и YT-партнёры', description: 'Заявки на партнёрку и коллаборации.', prefixes: ['Заявка', 'Одобрено', 'Отказано'] },
    ],
  },
  {
    slug: 'razdel-zhalob', title: 'Раздел жалоб', forums: [
      { slug: 'zhaloby-na-igroka', title: 'Жалобы на игрока', description: 'Только с доказательством. Без пруфа — не рассматривается.', prefixes: CLAIM_PREFIXES },
      { slug: 'apellyatsii-na-nakazanie', title: 'Апелляции на наказание', description: 'Одна ветка на наказание. Повторные — игнор.', prefixes: CLAIM_PREFIXES },
      { slug: 'zhaloby-na-administratsiyu', title: 'Жалобы на администрацию', description: 'Действия персонала: хамство, превышение, ошибка выдачи.', prefixes: CLAIM_PREFIXES },
    ],
  },
  {
    slug: 'ostal-noye', title: 'Остальное', forums: [
      { slug: 'faq', title: 'Вопросы и ответы (F.A.Q.)', description: 'Ответы на то, что спрашивают каждый день.', read_role: 'guest', write_role: 'admin', prefixes: NONE },
      { slug: 'idei-i-pozhelaniya', title: 'Идеи и пожелания', description: 'Что добавить на сервер. Одна идея — одна ветка.', prefixes: ['Идея', 'Принято', 'Отклонено'] },
      { slug: 'kurilka', title: 'Курилка', description: 'Общение не по теме. Правила раздела в силе.', prefixes: NONE },
    ],
  },
  {
    slug: 'sluzhebnoye', title: 'Служебное', read_role: 'helper', forums: [
      { slug: 'zhurnal-modera-cii', title: 'Журнал модерации', description: 'Состав: только чтение обращений и записи по своим решениям.', read_role: 'helper', write_role: 'helper', prefixes: NONE },
      { slug: 'vnutri-komandy', title: 'Внутрикомандное', description: 'Обсуждение сервера, обновлений и дежурств.', read_role: 'helper', write_role: 'helper', prefixes: NONE },
    ],
  },
];

export const STARTERS = [
  {
    forum: 'pravila', title: 'Правила Premazing', prefix: '', body: `# ПРАВИЛА PREMAZING

## 1. Сервер
1.1. Баг — это не привилегия. Нашёл → тема в «Недоработки игрового мода», а не использование.
1.2. Мультиаккаунт, обход бана, читы и модификации вне нашей клиентской сборки → перманентно.
1.3. Дюринг, РП-слив, метарп, PowerGamer — срок зависит от того, впервые или нет.

## 2. Общение
2.1. Уважай игроков и персонал. Провокации, травля, разжигание — мут от 12 часов.
2.2. 18+ контент, разжигание ненависти, чужие личные данные без согласия — удаление + бан.
2.3. Реклама другого проекта или переманивание в ЛС — бан без апелляции.
2.4. ЛС персоналу не для жалоб. Жалоба — только раздел «Жалобы на игрока».

## 3. Форум
3.1. Одна тема — одна проблема. Не создавай дубли, даже если ответ не пришёл.
3.2. Название темы по существу: не «помогите», а «ДПС: не выдаётся рапорт после /menu».
3.3. Личные данные игроков, фото документов и переписки без согласия — удаление темы.
3.4. Темы в неподходящем разделе переносит администрация, предупреждения не будет.

## 4. Жалобы и апелляции
4.1. Жалоба без пруфа (видео / серверные логи / скрин со временем) не рассматривается.
4.2. Не согласен с наказанием — одна тема в «Апелляции на наказание». Повторные = игнор.
4.3. Спор с решением админа в публичном чате = доп. наказание.

Последнее изменение: 06.11.2026`,
  },
  {
    forum: 'kak-zaiti', title: 'Как зайти на сервер White', prefix: '', body: `# КАК ЗАЙТИ

## Шаг 1. Клиент
Нужен чистый GTA SA 1.0 US + SA-MP 0.3.7. Наша сборка с CEF — в разделе «Скачать клиент».

## Шаг 2. Добавляем сервер вручную
Сервер не публикуется в общем списке, поэтому адрес вбиваем сами:
SA-MP → Add Server → вставь адрес → Add Selected → Connect

    80.242.59.112:4141

## Шаг 3. Первый вход
/login или /reg по нику, дальше — обучение.
Горячие клавиши: /hotkeys · помощь: /help · поддержка в игре: /support

## Не заходит?
Server you are trying to connect is not available — сервер рестартует, подожди 2-3 минуты и проверь «Новости и обновления».
Вылетает при загрузке — ставь нашу CEF-сборку, а не свой набор модов.
Пропал звук или картинка в диалогах — /cefreload, затем /usecef.
Не пускает по нику — тема в «Вопросы и ответы» или «Восстановление доступа к аккаунту».`,
  },
  {
    forum: 'skachat-klient', title: 'Клиент Premazing: состав и установка', prefix: '', body: `# КЛИЕНТ PREMAZING

## В составе
- GTA SA 1.0 US
- SA-MP 0.3.7
- samp-cef 1.4.1 — интерфейсы, карта, телефон
- MoonLoader + hide_hud.lua — убирает стандартный SA-MP HUD
- SAMPFUNCS

## Установка
1. Скачай архив, распакуй в новую папку, не в существующую игру.
2. Проверь: gta_sa.exe запускается, папка moonloader\\ на месте.
3. Запусти, /login.

> Не ставь поверх своей сборки с читами или модами — получишь конфликты и вылеты, а диагностика по такой сборке невозможна.

Ссылка на сборку и версия — в закрепленной теме этого раздела и в #скачать-клиент Discord-сервера.`,
  },
  {
    forum: 'pravila-tekhnicheskogo-razdela', title: 'Правила технического раздела', prefix: '', body: `# ПРАВИЛА ТЕХНИЧЕСКОГО РАЗДЕЛА

## Что сюда
То, что работает не так, как задумано: скрипт, модель, объект, ТС, сайт, оплата.

## Что не сюда
Не согласен с балансом или решением администрации → «Идеи и пожелания» или «Жалобы на администрацию».

## Пруф обязателен
- видео или скрин с серверным временем
- ник, адрес 80.242.59.112:4141, версия клиента
- что делал шаг за шагом и что получил

## Статусы тем
Баг → Дубликат → В работе → Исправлено. Статус меняет администрация, автор темы — нет.

## Скорость ответа
Технические темы читаются после жалоб и апелляций. «Ответьте быстрее» не ускоряет, а дубли — удаляются.`,
  },
  {
    forum: 'nedorabotki-moda', title: 'Шаблон: недоработка игрового мода', prefix: 'Баг', body: `# ШАБЛОН БАГ-РЕПОРТА

**Что сломалось**
одна строка, без «нечего не работает»

**Как повторить**
1. 
2. 
3. 

**Ждал / получил**
Должно: 
Фактически: 

**Когда**
дата и точное время с сервера

**Сборка**
IP 80.242.59.112:4141 · ник · версия клиента из «Скачать клиент»

**Пруф**
видео или скрин файлом. Ссылка на YouTube без таймкода = не пруф.`,
  },
  {
    forum: 'nedorabotki-ts', title: 'Шаблон: недоработка транспортного средства', prefix: 'Баг', body: `# ШАБЛОН: ТС

**Модель и ID ТС**
**Что происходит**
застрял, не заводится, улетела текстура, не открывается салон
**Где**
координаты или название точки
**Пруф**
скрин или видео файлом
**Сборка**
ник · IP 80.242.59.112:4141 · версия клиента`,
  },
  {
    forum: 'nedorabotki-modelei', title: 'Шаблон: недоработка модели или скина', prefix: 'Баг', body: `# ШАБЛОН: МОДЕЛИ И СКИНЫ

**Что и где**
модель, скин, анимация или звук + где именно видно проблему
**Как должно выглядеть**
**Пруф**
скрин файлом, для звука — видео с записью
**Клиент**
наша сборка или своя? укажи явно: на своей сборке не диагностируем`,
  },
  {
    forum: 'nedorabotki-karty', title: 'Шаблон: недоработка карты или объекта', prefix: 'Баг', body: `# ШАБЛОН: КАРТА И ОБЪЕКТЫ

**Точка**
координаты /health и название улицы, либо интерьер
**Проблема**
невидимая стена, провал, торчит объект, не работает вход
**Можно ли обойти**
да/нет — влияет на приоритет
**Пруф**
скрин с координатами на кадре`,
  },
  {
    forum: 'nedorabotki-saita', title: 'Шаблон: недоработка сайта, кабинета или форума', prefix: 'Баг', body: `# ШАБЛОН: САЙТ И ЛАУНЧЕР

**Страница и адрес**
**Браузер и устройство**
телефон или ПК, браузер — обязательно
**Что делали**
шаги
**Что получилось**
текст ошибки как есть, без пересказа
**Скрин**`,
  },
  {
    forum: 'problemy-s-donatom', title: 'Как оформить обращение по донату', prefix: 'Вопрос', body: `# ДОНАТ: ЧТО НУЖНО В ОБРАЩЕНИИ

**Ник на сервере**
**Что куплено**
позиция из магазина, сумма
**Когда**
дата и время операции
**Способ оплаты**
**Номер операции**
берётся в квитанции банка или в письме от платежной системы
**Что не пришло**
Скрин квитанции файлом. Без номера операции и скрина обращение не двигается.

Выдача происходит в игре; если прошло больше суток — пиши в теме, не в ЛС персоналу.`,
  },
  {
    forum: 'vosstanovleniye-dostupa', title: 'Восстановление доступа к аккаунту', prefix: 'Запрос', body: `# ВОССТАНОВЛЕНИЕ ДОСТУПА

**Ник**
**Когда создан примерно**
**Последний вход**
**Во что вкладывался**
покупки, авто, бизнес — то, что есть только у тебя
**Контакт**
Discord или почта, куда прислать новый пароль

> Доступ выдаётся только при совпадении нескольких фактов: ник, история входа, покупки. Один скрин переписки не основание.

Не пиши здесь пароль, номер карты или код из СМС. Ни администрация, ни поддержка их не запрашивают.`,
  },
  {
    forum: 'igrovoye-zakonodatel-stvo', title: 'Что публикуется в этом разделе', prefix: '', body: `# ИГРОВОЕ ЗАКОНОДАТЕЛЬСТВО

Сюда — действующие нормы, которые применяются на сервере: уставы силовых структур, приказы, разъяснения по RP-нормам и пограничные случаи из п. 1 и 3 правил.

Пишет и редактирует администрация. Игроки не оставляют ответы в этих темах — для вопросов есть «Обсуждение сервера».

Уставы конкретных фракций и внутренние приказы публикует старший состав: на форуме только то, что действует на всех.`,
  },
  {
    forum: 'novosti-i-obnovleniya', title: 'Форум Premazing открыт', prefix: 'Анонс', body: `# ФОРУМ PREMAZING ОТКРЫТ

Завели форум для сервера White. Что куда писать:

- баги мода, ТС, моделей, карты — «Технический раздел»
- не пришел донат, потерян доступ — соответствующие темы там же
- жалоба на игрока, апелляция на бан — «Раздел жалоб», только с пруфом
- вопросы по геймплею — «F.A.Q.», потом «Обсуждение сервера»
- идеи — «Идеи и пожелания»

Сервер: 80.242.59.112:4141 · SA-MP 0.3.7 · 50 слотов · в общем списке нет, добавляй вручную.
Быстрое общение и озвон — Discord-сервер, ссылка в «Важные ссылки».`,
  },
  {
    forum: 'zhaloby-na-igroka', title: 'Шаблон жалобы на игрока', prefix: 'Открыто', body: `# ШАБЛОН ЖАЛОБЫ

**Кто нарушил**
ник с сервера, точно как в /login
**Когда**
дата и точное время
**Пункт правил**
номер из раздела «Правила игры и форума»
**Доказательство**
видео или скрин файлом, без ссылки на сторонний диск
**Что было до**
предупреждал? игнорит?

Жалоба без пруфа закрывается без рассмотрения. Жалоба ради жалобы — доп. наказание заявителю.`,
  },
  {
    forum: 'apellyatsii-na-nakazanie', title: 'Шаблон апелляции на наказание', prefix: 'Открыто', body: `# ШАБЛОН АПЕЛЛЯЦИИ

**Ник**
**За что**
причина как её выдал мод или админ
**Срок**
**Что было не так**
по существу, без «админы куплены»
**Готов соблюдать правила**
напиши явно

Одна тема на одно наказание. Обновляй её, а не создавай новую. Спор с решением в игровом чате добавит срок, а не снимет.`,
  },
  {
    forum: 'zhaloby-na-administratsiyu', title: 'Шаблон жалобы на администрацию', prefix: 'Открыто', body: `# ШАБЛОН: ДЕЙСТВИЯ ПЕРСОНАЛА

**Имя админа или хелпера**
ник из /adminlist на момент ситуации
**Когда**
**Что сделал персонал**
выдача, кик, мут, отказ, тон общения
**Нарушение какого пункта**
правила форума или регламента персонала
**Пруф**
скрин или видео файлом

> Пишем по факту. «Мне не понравился тон» без цитаты и скрина не рассматривается.

Ответ приходит в этой теме; тема остаётся открытой до решения.`,
  },
  {
    forum: 'faq', title: 'F.A.Q. по серверу White', prefix: '', body: `# FAQ

**Сервер в общем списке?**
Нет, только вручную: 80.242.59.112:4141.

**Сколько слотов?**
50.

**Как слушать свою музыку в машине?**
/audio_install (150 000 ₽) → /player. Треки: кнопка «+» в плеере, ссылка на mp3. Кабинет для загрузки — «Кабинет «Автозвук»» в «Важные ссылки».

**Голос в игре?**
/voice, радиус — /vradius.

**Как получить работу или фракцию?**
/menu, либо /support и спроси в игре.

**Куда жаловаться на админа?**
Только «Жалобы на администрацию» с пруфом.

**Как стать хелпером?**
Следи за новостями здесь и в Discord — набор открываем анонсом.

**Почему тема висит без ответа?**
Сроки не обещаем. Дубли и «ап» не ускоряют: тема с плохим пруфом уедет в конец очереди.`,
  },
  {
    forum: 'idei-i-pozhelaniya', title: 'Шаблон идеи', prefix: 'Идея', body: `# ШАБЛОН ИДЕИ

**Идея**
одна тема — одна идея
**Зачем игроку**
что меняется в геймплее, а не «сделать красивее»
**Как понять, что получилось**
признак, по которому проверим через неделю
**Цена**
что нужно добавить или переписать, если знаешь

Идеи уже в работе помечаются «Принято», отказываем с причиной — «Отклонено».`,
  },
  {
    forum: 'sotrudnichestvo', title: 'YT-партнёрство: как подать заявку', prefix: 'Заявка', body: `# YT-ПАРТНЁРСТВО

Заявка в этом разделе, по шаблону:

**Канал**
ссылка
**Что снимаешь по Premazing**
2-3 последних видео
**Частота**
сколько роликов в месяц
**Что ожидаешь**
цвет /youtuber в чате, ивенты, освещение новостей

Требования к каналу и слоты объявляем анонсом в «Новости и обновления». Без активного материала по серверу заявка закрывается как «Отказано».`,
  },
  {
    forum: 'zhurnal-modera-cii', title: 'Регламент журнала модерации', prefix: '', body: `# ЖУРНАЛ МОДЕРАЦИИ

Каждое решение фиксируется записью в теме обращения:

- кто принял (ник из /adminlist)
- пункт правил
- срок и что учтено
- что от игрока ожидалось

Хелпер не пишет в журнал: он отвечает в «Обсуждении сервера» и переносит спорное к администрации.

Записи не удаляем. Ошибочную запись дополняем следующей с пометкой «корректировка».`,
  },
  {
    forum: 'vnutri-komandy', title: 'Регламент команды', prefix: '', body: `# РЕГЛАМЕНТ КОМАНДЫ

**Хелпер**
отвечает на вопросы в «Обсуждении сервера», жалобы не рассматривает, наказаний не выдаёт.
**Куратор**
читает обращения и готовит их к разбору, наказаний не выдаёт.
**Администрация**
решает жалобы и апелляции, меняет статусы тем, ведёт журнал.
**Разработка**
мод, клиент, сайт и база. Технические темы без подтверждения разработки не исправляются «на глаз».

Общее:
- личные данные игроков не выносим за пределы раздела
- решения по донату без чека не выдаём
- доступ к аккаунту только при совпадении фактов из темы «Восстановление доступа»`,
  },
];

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Детерминированный UUID (v5-подобный) из имени узла. Повторный сид вставляет
// те же строки, insertIfAbsent их отклоняет — дублей не появляется.
export async function stableUuid(name) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`premaze-forum:${name}`)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = hex(bytes);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

const DEFAULT_ROLES = { read_role: 'guest', write_role: 'member', prefixes: NONE };

export function planNodes() {
  const categories = [];
  const forums = [];
  STRUCTURE.forEach((category, categoryIndex) => {
    const categoryId = { name: `category:${category.slug}` };
    categories.push({
      key: category.slug,
      name: categoryId.name,
      slug: category.slug,
      title: category.title,
      sort_order: categoryIndex + 1,
      read_role: category.read_role ?? 'guest',
    });
    category.forums.forEach((forum, forumIndex) => {
      forums.push({
        key: forum.slug,
        name: `forum:${forum.slug}`,
        categoryKey: category.slug,
        sort_order: forumIndex + 1,
        ...DEFAULT_ROLES,
        ...forum,
        title: forum.title,
        description: forum.description ?? '',
      });
    });
  });
  return { categories, forums };
}

// Один проход: если категорий нет, достраиваем дерево и закрепляем стартовые темы.
// Счётчики тем/сообщений проставляются сразу, чтобы лента не была пустой.
export async function ensureStructure(db, now = Date.now()) {
  const existing = rows(await db.from('categories').select('id').limit(1));
  if (existing.length > 0) return false;

  const { categories, forums } = planNodes();
  const categoryIds = new Map();
  for (const category of categories) categoryIds.set(category.key, await stableUuid(category.name));
  const forumIds = new Map();
  for (const forum of forums) forumIds.set(forum.key, await stableUuid(forum.name));

  for (const category of categories) {
    rows(await db.from('categories').insertIfAbsent({
      id: categoryIds.get(category.key),
      slug: category.slug,
      title: category.title,
      sort_order: category.sort_order,
      read_role: category.read_role,
    }, { onConflict: 'slug' }).select('id'));
  }

  for (const forum of forums) {
    rows(await db.from('forums').insertIfAbsent({
      id: forumIds.get(forum.key),
      category_id: categoryIds.get(forum.categoryKey),
      slug: forum.slug,
      title: forum.title,
      description: forum.description,
      sort_order: forum.sort_order,
      read_role: forum.read_role,
      write_role: forum.write_role,
      prefixes: forum.prefixes,
      external_url: forum.external_url ?? null,
      topic_count: 0,
      post_count: 0,
      last_topic_id: null,
      last_post_at: null,
    }, { onConflict: 'slug' }).select('id'));
  }

  const systemId = await stableUuid('user:system');
  rows(await db.from('users').insertIfAbsent({
    id: systemId,
    username: 'premaze',
    display_name: 'Premazing',
    password_salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
    password_hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    password_iterations: 300000,
    role: 'admin',
    created_at: new Date(now).toISOString(),
  }, { onConflict: 'username' }).select('id'));

  const byForum = new Map();
  for (const starter of STARTERS) {
    const list = byForum.get(starter.forum) ?? [];
    list.push(starter);
    byForum.set(starter.forum, list);
  }

  for (const [forumKey, starters] of byForum) {
    const forumId = forumIds.get(forumKey);
    let lastTopicId = null;
    let lastPostAt = null;
    for (let index = 0; index < starters.length; index += 1) {
      const starter = starters[index];
      const topicId = await stableUuid(`topic:${starter.title}`);
      const postId = await stableUuid(`post:${starter.title}`);
      const createdAt = new Date(now - (starters.length - index) * 60000).toISOString();
      rows(await db.from('topics').insertIfAbsent({
        id: topicId,
        forum_id: forumId,
        title: starter.title,
        prefix: starter.prefix ?? '',
        author_id: systemId,
        author_name: 'Premazing',
        author_role: 'admin',
        created_at: createdAt,
        last_post_at: createdAt,
        last_poster_name: 'Premazing',
        reply_count: 0,
        view_count: 0,
        is_pinned: true,
        is_locked: false,
        is_deleted: false,
      }, { onConflict: 'id' }).select('id'));
      rows(await db.from('posts').insertIfAbsent({
        id: postId,
        topic_id: topicId,
        floor: 1,
        author_id: systemId,
        author_name: 'Premazing',
        author_role: 'admin',
        body: starter.body,
        created_at: createdAt,
        edited_at: null,
        is_deleted: false,
      }, { onConflict: 'id' }).select('id'));
      lastTopicId = topicId;
      lastPostAt = createdAt;
    }
    rows(await db.from('forums').update({
      topic_count: starters.length,
      post_count: starters.length,
      last_topic_id: lastTopicId,
      last_post_at: lastPostAt,
    }).eq('id', forumId).select('id'));
  }

  return true;
}
