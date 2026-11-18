// Реплика того же интерфейса обёртки БД, что даёт платформа, только в памяти.
// Нужна, чтобы прогнать настоящие маршруты без облачных ключей.
const UNIQUE = {
  users: ['id', 'username'],
  sessions: ['token_digest'],
  auth_limiter: ['key'],
  categories: ['id', 'slug'],
  forums: ['id', 'slug'],
  topics: ['id'],
  posts: ['id'],
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compare(left, right) {
  if (left === right) return true;
  if (left === null || right === null || left === undefined || right === undefined) return false;
  if (typeof left === 'string' && typeof right === 'string') return new Date(left).getTime() === new Date(right).getTime();
  return false;
}

class Query {
  constructor(store, table) {
    this.store = store;
    this.table = table;
    this.columns = null;
    this.filters = [];
    this.sort = null;
    this.take = null;
    this.mutation = null;
  }

  select(columns) {
    this.columns = String(columns).split(',').map((name) => name.trim()).filter(Boolean);
    return this;
  }

  eq(column, value) {
    this.filters.push([column, value]);
    return this;
  }

  order(column, options = {}) {
    this.sort = { column, ascending: options.ascending !== false };
    return this;
  }

  limit(count) {
    this.take = count;
    return this;
  }

  insert(row) {
    this.mutation = { kind: 'insert', row };
    return this;
  }

  insertIfAbsent(row, options = {}) {
    this.mutation = { kind: 'insert-absent', row, onConflict: String(options.onConflict || '') };
    return this;
  }

  update(patch) {
    this.mutation = { kind: 'update', patch };
    return this;
  }

  matched() {
    const rows = this.store[this.table] || [];
    let found = rows.filter((row) => this.filters.every(([column, value]) => compare(row[column], value)));
    if (this.sort) {
      const { column, ascending } = this.sort;
      found = [...found].sort((a, b) => {
        const left = a[column];
        const right = b[column];
        if (left === right) return 0;
        if (left === null || left === undefined) return 1;
        if (right === null || right === undefined) return -1;
        return (left < right ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    return found;
  }

  project(rows) {
    if (!this.columns) return rows.map(clone);
    return rows.map((row) => Object.fromEntries(this.columns.filter((name) => name in row).map((name) => [name, clone(row[name])])));
  }

  run() {
    if (this.table && !this.store[this.table]) return { data: [], error: { code: 'table_missing', status: 500 } };
    if (this.mutation?.kind === 'insert') {
      this.store[this.table].push(clone(this.mutation.row));
      return { data: this.project([this.mutation.row]), error: null };
    }
    if (this.mutation?.kind === 'insert-absent') {
      const keys = (this.mutation.onConflict ? this.mutation.onConflict.split(',').map((name) => name.trim()) : [])
        .concat(UNIQUE[this.table] || ['id']);
      const clash = [...new Set(keys)].some((column) =>
        this.store[this.table].some((row) => compare(row[column], this.mutation.row[column])));
      if (clash) return { data: [], error: null };
      this.store[this.table].push(clone(this.mutation.row));
      return { data: this.project([this.mutation.row]), error: null };
    }
    if (this.mutation?.kind === 'update') {
      const affected = this.matched();
      for (const row of affected) Object.assign(row, clone(this.mutation.patch));
      return { data: this.project(affected), error: null };
    }
    let found = this.matched();
    if (this.take !== null) found = found.slice(0, this.take);
    return { data: this.project(found), error: null };
  }

  then(resolve, reject) {
    return Promise.resolve(this.run()).then(resolve, reject);
  }
}

export function createFakeDb(seed = {}) {
  const store = {};
  const names = ['users', 'sessions', 'auth_limiter', 'categories', 'forums', 'topics', 'posts'];
  for (const name of names) store[name] = (seed[name] || []).map(clone);
  return {
    store,
    from(table) {
      if (!store[table]) {
        return {
          select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
          insert() { return this; }, insertIfAbsent() { return this; }, update() { return this; },
          then(resolve) { return Promise.resolve({ data: [], error: { code: 'table_missing', status: 500 } }).then(resolve); },
        };
      }
      return new Query(store, table);
    },
  };
}
