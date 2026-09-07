import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

export type WordFind = {
  studentName: string;
  bookId: string;
  bookName: string;
  pageId: string;
  pagePosition: number;
  wordId: string;
  wordText: string;
  timeMs: number;
  wrongClicks: number;
  foundAt: string;
};

export type StudentBookFinds = {
  studentName: string;
  bookId: string;
  bookName: string;
  pageCount: number;
  wordCount: number;
  updatedAt: string;
  finds: WordFind[];
};

type FindRow = {
  student_name: string;
  book_id: string;
  book_name: string;
  page_id: string;
  page_position: number;
  word_id: string;
  word_text: string;
  time_ms: number;
  wrong_clicks: number;
  found_at: string;
  page_count: number;
};

/**
 * Record one found word for a student. Upserts the (student, book, page, word)
 * row so a replay of the same page replaces the previous attempt.
 */
export const recordWordFindFn = createServerFn({ method: "POST" })
  .validator((input: {
    studentName: string;
    bookId: string;
    pageId: string;
    pagePosition: number;
    wordId: string;
    wordText: string;
    timeMs: number;
    wrongClicks: number;
  }) => {
    if (typeof input?.studentName !== "string" || !input.studentName.trim()) {
      throw new Error("studentName required");
    }
    if (typeof input?.bookId !== "string" || !input.bookId) throw new Error("bookId required");
    if (typeof input?.pageId !== "string" || !input.pageId) throw new Error("pageId required");
    if (typeof input?.wordId !== "string" || !input.wordId) throw new Error("wordId required");
    if (typeof input?.wordText !== "string" || !input.wordText.trim()) {
      throw new Error("wordText required");
    }
    const timeMs =
      typeof input.timeMs === "number" && Number.isFinite(input.timeMs) && input.timeMs >= 0
        ? Math.round(input.timeMs)
        : 0;
    const wrongClicks =
      typeof input.wrongClicks === "number" && Number.isFinite(input.wrongClicks) && input.wrongClicks >= 0
        ? Math.round(input.wrongClicks)
        : 0;
    const pagePosition =
      typeof input.pagePosition === "number" && Number.isFinite(input.pagePosition)
        ? Math.max(0, Math.round(input.pagePosition))
        : 0;
    return {
      studentName: input.studentName.trim().slice(0, 60),
      bookId: input.bookId,
      pageId: input.pageId,
      pagePosition,
      wordId: input.wordId,
      wordText: input.wordText.trim().slice(0, 80),
      timeMs,
      wrongClicks,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    const id = `${data.studentName}:${data.bookId}:${data.pageId}:${data.wordId}`;
    await sql`
      insert into word_finds (
        id, student_name, book_id, page_id, page_position, word_id, word_text,
        time_ms, wrong_clicks, found_at
      )
      values (
        ${id},
        ${data.studentName},
        ${data.bookId},
        ${data.pageId},
        ${data.pagePosition},
        ${data.wordId},
        ${data.wordText},
        ${data.timeMs},
        ${data.wrongClicks},
        now()
      )
      on conflict (id) do update set
        page_position = ${data.pagePosition},
        word_text = ${data.wordText},
        time_ms = ${data.timeMs},
        wrong_clicks = ${data.wrongClicks},
        found_at = now()
    `;
    return { ok: true };
  });

/** All word-finds grouped by student + book, newest activity first. Teacher view. */
export const listWordFindsFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<StudentBookFinds[]> => {
    const sql = await getSql();
    const rows = await sql<FindRow>`
      select
        f.student_name, f.book_id, b.name as book_name,
        f.page_id, f.page_position, f.word_id, f.word_text,
        f.time_ms, f.wrong_clicks, f.found_at,
        (select count(*) from book_pages p where p.book_id = f.book_id) as page_count
      from word_finds f
      join books b on b.id = f.book_id
      order by f.found_at desc
    `;
    const groups = new Map<string, StudentBookFinds>();
    for (const r of rows) {
      const key = `${r.student_name}:${r.book_id}`;
      const find: WordFind = {
        studentName: r.student_name,
        bookId: r.book_id,
        bookName: r.book_name,
        pageId: r.page_id,
        pagePosition: Number(r.page_position) || 0,
        wordId: r.word_id,
        wordText: r.word_text,
        timeMs: Number(r.time_ms) || 0,
        wrongClicks: Number(r.wrong_clicks) || 0,
        foundAt: r.found_at,
      };
      const existing = groups.get(key);
      if (existing) {
        existing.finds.push(find);
        existing.wordCount += 1;
        if (r.found_at > existing.updatedAt) existing.updatedAt = r.found_at;
      } else {
        groups.set(key, {
          studentName: r.student_name,
          bookId: r.book_id,
          bookName: r.book_name,
          pageCount: Number(r.page_count) || 0,
          wordCount: 1,
          updatedAt: r.found_at,
          finds: [find],
        });
      }
    }
    return [...groups.values()].sort((a, b) => {
      if (a.updatedAt === b.updatedAt) {
        return a.studentName.localeCompare(b.studentName) || a.bookName.localeCompare(b.bookName);
      }
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
  },
);
