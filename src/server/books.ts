import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import type { Book, BookPage } from "@/lib/book-model";

type BookRow = { id: string; name: string; created_at: string };
type PageRow = { id: string; position: number; created_at: string; payload: BookPage };

const DEMO_BOOK_ID = "demo-teeth-book";
const DEMO_PAGE_ID = "demo-teeth-page";

/** Sample spread from /sample-page.png (1600×1000) so student mode is playable on a fresh DB. */
function demoPage(): BookPage {
  const word = (
    id: string,
    text: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): BookPage["words"][number] => ({
    id,
    text,
    phonetic: null,
    bbox: { x0, y0, x1, y1 },
    confidence: 99,
    confirmed: true,
  });
  return {
    id: DEMO_PAGE_ID,
    createdAt: new Date(0).toISOString(),
    image: { name: "sample-page.png", src: "/sample-page.png", width: 1600, height: 1000 },
    words: [
      word("w-i", "I", 200, 324, 260, 404),
      word("w-brush", "brush", 268, 324, 556, 404),
      word("w-my", "My", 584, 324, 692, 404),
      word("w-teeth", "Teeth", 700, 324, 880, 404),
      word("w-every", "every", 200, 504, 536, 584),
      word("w-morning", "morning", 584, 504, 788, 584),
    ],
    layout: "single",
    sentenceOverride: null,
    hasPreviewed: true,
    approved: true,
    approvedAt: new Date(0).toISOString(),
  };
}

async function ensureDemoBook() {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from books limit 1`;
  if (existing[0]) return;
  const page = demoPage();
  await sql`insert into books (id, name) values (${DEMO_BOOK_ID}, ${"I Brush My Teeth"}) on conflict (id) do nothing`;
  await sql`
    insert into book_pages (id, book_id, position, created_at, payload)
    values (
      ${DEMO_PAGE_ID},
      ${DEMO_BOOK_ID},
      0,
      ${page.createdAt},
      ${JSON.stringify(page)}::jsonb
    )
    on conflict (id) do nothing
  `;
}

/** Every book with its pages in reading order. Unowned (no auth), demo-level. */
export const listBooks = createServerFn({ method: "POST" }).handler(async (): Promise<Book[]> => {
  const sql = await getSql();
  await ensureDemoBook();
  const books = await sql<BookRow>`select id, name, created_at from books order by created_at asc`;
  if (books.length === 0) return [];
  const pages = await sql<PageRow>`
    select id, book_id, position, created_at, payload
    from book_pages order by book_id, position asc
  `;
  const byBook = new Map<string, BookPage[]>();
  for (const p of pages as Array<PageRow & { book_id: string }>) {
    const list = byBook.get(p.book_id) ?? [];
    list.push({ ...p.payload, id: p.id });
    byBook.set(p.book_id, list);
  }
  return books.map((b) => ({
    id: b.id,
    name: b.name,
    createdAt: b.created_at,
    pages: byBook.get(b.id) ?? [],
  }));
});


/** Create a book; returns the new book id. */
export const createBookFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; name: string }) => {
    if (typeof input?.id !== "string" || !input.id) throw new Error("id required");
    if (typeof input?.name !== "string" || !input.name.trim()) throw new Error("name required");
    return { id: input.id, name: input.name.trim().slice(0, 120) };
  })
  .handler(async ({ data }): Promise<{ id: string }> => {
    const sql = await getSql();
    await sql`insert into books (id, name) values (${data.id}, ${data.name})`;
    return { id: data.id };
  });

/**
 * Insert or replace one page's snapshot, preserving its created_at and keeping
 * it at its existing position (or appending). The position column is the page's
 * order in the book.
 */
export const upsertPageFn = createServerFn({ method: "POST" })
  .validator((input: { bookId: string; page: BookPage }) => {
    if (typeof input?.bookId !== "string" || !input.bookId) throw new Error("bookId required");
    if (typeof input?.page?.id !== "string" || !input.page.id) throw new Error("page.id required");
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    const existing = await sql<{ position: number; created_at: string }>`
      select position, created_at from book_pages where id = ${data.page.id}
    `;
    let position: number;
    if (existing[0]) {
      position = existing[0].position;
    } else {
      const max = await sql<{ m: number | null }>`
        select max(position) as m from book_pages where book_id = ${data.bookId}
      `;
      position = (max[0]?.m ?? -1) + 1;
    }
    await sql`
      insert into book_pages (id, book_id, position, created_at, payload)
      values (
        ${data.page.id},
        ${data.bookId},
        ${position},
        ${existing[0]?.created_at ?? new Date().toISOString()},
        ${JSON.stringify(data.page)}::jsonb
      )
      on conflict (id) do update set payload = ${JSON.stringify(data.page)}::jsonb, book_id = ${data.bookId}
    `;
    return { ok: true };
  });

/** Persist a full ordering of page ids for a book (position = array index). */
export const setPageOrderFn = createServerFn({ method: "POST" })
  .validator((input: { bookId: string; pageIds: string[] }) => {
    if (typeof input?.bookId !== "string" || !input.bookId) throw new Error("bookId required");
    if (!Array.isArray(input?.pageIds)) throw new Error("pageIds required");
    return { bookId: input.bookId, pageIds: input.pageIds.filter((x) => typeof x === "string") };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    for (let i = 0; i < data.pageIds.length; i += 1) {
      await sql`update book_pages set position = ${i} where id = ${data.pageIds[i]} and book_id = ${data.bookId}`;
    }
    return { ok: true };
  });

/** Remove a single page from its book. */
export const removePageFn = createServerFn({ method: "POST" })
  .validator((input: { pageId: string }) => {
    if (typeof input?.pageId !== "string" || !input.pageId) throw new Error("pageId required");
    return { pageId: input.pageId };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`delete from book_pages where id = ${data.pageId}`;
    return { ok: true };
  });

/** Remove one book (and its pages via cascade). Not a bulk delete. */
export const deleteBookFn = createServerFn({ method: "POST" })
  .validator((input: { bookId: string }) => {
    if (typeof input?.bookId !== "string" || !input.bookId) throw new Error("bookId required");
    return { bookId: input.bookId };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`delete from books where id = ${data.bookId}`;
    return { ok: true };
  });
