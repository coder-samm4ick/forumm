// Линт: каждый класс из разметки должен иметь правило в styles.css, и наоборот.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.slice(1));
const css = fs.readFileSync(path.join(here, '../web/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(here, '../web/index.html'), 'utf8');
const js = fs.readFileSync(path.join(here, '../web/app.js'), 'utf8');

const defined = new Set((css.match(/\.[a-zA-Z][\w-]*/g) || []).map((s) => s.slice(1)));
const used = new Set();

for (const match of (html + js).matchAll(/class="([^"]*)"/g)) {
  for (const token of match[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
    if (token) used.add(token);
  }
}
// динамические хвосты: label--${...}, avatar--${size}, structItem-cell--${cls}
for (const prefix of ['label--', 'avatar--', 'structItem-cell--', 'button--']) {
  for (const name of defined) if (name.startsWith(prefix)) used.add(name);
}

const missing = [...used].filter((c) => !defined.has(c)).sort();
const unseen = [...defined].filter((c) => !used.has(c)).sort();

console.log('разметка → нет правила в CSS:', missing.join(', ') || '—');
console.log('CSS → класс не встречается:', unseen.join(', ') || '—');
