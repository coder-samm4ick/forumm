-- Premazing forum: business schema for a function_backend site.
-- Supported subset only: CREATE TABLE app.*, plain CREATE INDEX, no DML, no CHECK, no varchar(n).
-- Порядок узлов называется sort_order: валидатор платформы отвергает колонку position.
-- Access policies are generated privately by the platform (accessPolicies: []).

CREATE TABLE app.users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  password_iterations integer NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE app.sessions (
  token_digest text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.users (id),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE app.auth_limiter (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL
);

CREATE TABLE app.categories (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  sort_order integer NOT NULL,
  read_role text NOT NULL
);

CREATE INDEX categories_order_idx ON app.categories (sort_order);

CREATE TABLE app.forums (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES app.categories (id),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL,
  read_role text NOT NULL,
  write_role text NOT NULL,
  prefixes jsonb NOT NULL,
  external_url text,
  topic_count integer NOT NULL,
  post_count integer NOT NULL,
  last_topic_id uuid,
  last_post_at timestamptz
);

CREATE INDEX forums_category_order_idx ON app.forums (category_id, sort_order);

CREATE TABLE app.topics (
  id uuid PRIMARY KEY,
  forum_id uuid NOT NULL REFERENCES app.forums (id),
  title text NOT NULL,
  prefix text NOT NULL,
  author_id uuid NOT NULL REFERENCES app.users (id),
  author_name text NOT NULL,
  author_role text NOT NULL,
  created_at timestamptz NOT NULL,
  last_post_at timestamptz NOT NULL,
  last_poster_name text NOT NULL,
  reply_count integer NOT NULL,
  view_count integer NOT NULL,
  is_pinned boolean NOT NULL,
  is_locked boolean NOT NULL,
  is_deleted boolean NOT NULL
);

CREATE INDEX topics_forum_last_post_idx ON app.topics (forum_id, last_post_at);

CREATE INDEX topics_last_post_idx ON app.topics (last_post_at);

CREATE TABLE app.posts (
  id uuid PRIMARY KEY,
  topic_id uuid NOT NULL REFERENCES app.topics (id),
  floor integer NOT NULL,
  author_id uuid NOT NULL REFERENCES app.users (id),
  author_name text NOT NULL,
  author_role text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL,
  edited_at timestamptz,
  is_deleted boolean NOT NULL
);

CREATE INDEX posts_topic_floor_idx ON app.posts (topic_id, floor);
