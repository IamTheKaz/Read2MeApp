-- Page Aloud app schema — database-on / auth-off.
--
-- Per AGENTS.md §0.5 + the neon skill, these rows are UNOWNED (no user_id, or a
-- single literal constant) because the app has no sign-in. They are
-- world-readable/writable through the public server functions, so NOTHING here
-- is treated as sensitive: student names and times are demo-level tracking only.
-- No destructive bulk mutations (no delete-all / overwrite-all) are exposed.

-- Single shared teacher password (hashed, never plaintext). One row.
create table if not exists app_config (
  id          text primary key,           -- always the literal 'teacher'
  password_hash text,                     -- scrypt hash as hex; null until set
  salt        text,                       -- scrypt salt as hex
  updated_at  timestamptz not null default now()
);

-- Books. Page order is kept on the page rows (position), not in an array column.
create table if not exists books (
  id          text primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- One row per page; payload holds the full editor snapshot (image data URL,
-- words with boxes/phonetics, layout, sentence override, preview/approval).
create table if not exists book_pages (
  id          text primary key,
  book_id     text not null references books (id) on delete cascade,
  position    integer not null,
  created_at  timestamptz not null default now(),
  payload     jsonb not null
);
create index if not exists book_pages_book_idx on book_pages (book_id, position);

-- Student score tracking: one row per (student name, book). completed_pages is a
-- JSON array of page ids the student finished; best/first time kept in ms.
create table if not exists student_scores (
  id              text primary key,
  student_name    text not null,
  book_id         text not null references books (id) on delete cascade,
  completed_pages jsonb not null default '[]',
  time_ms         integer,                -- time of the most recent full run
  best_time_ms    integer,                -- fastest full run so far
  runs            integer not null default 0,
  updated_at      timestamptz not null default now(),
  unique (student_name, book_id)
);
create index if not exists student_scores_name_idx on student_scores (student_name);
