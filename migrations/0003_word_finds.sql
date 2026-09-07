-- Per-word find-the-word tracking for student reading.
-- Auth-off / unowned rows (student_name is typed, not a login). Demo-level only.
-- Replaces whole-book student_scores writes; that table is left in place from 0002
-- so existing databases keep applying cleanly.

create table if not exists word_finds (
  id              text primary key,
  student_name    text not null,
  book_id         text not null references books (id) on delete cascade,
  page_id         text not null,
  page_position   integer not null,
  word_id         text not null,
  word_text       text not null,
  time_ms         integer not null,
  wrong_clicks    integer not null default 0,
  found_at        timestamptz not null default now(),
  unique (student_name, book_id, page_id, word_id)
);
create index if not exists word_finds_student_book_idx on word_finds (student_name, book_id);
create index if not exists word_finds_book_page_idx on word_finds (book_id, page_position);
