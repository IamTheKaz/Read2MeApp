import type { PageImage, PageLayout, PageWord } from "@/lib/page-model";

/**
 * A book is a teacher-named, ordered collection of pages. Each page keeps the
 * full editor snapshot (image, words, sentence, approval state) so a book can
 * be reopened and edited at any time, even while partially complete. Position
 * within the book is the page's index in `pages`.
 */
export type BookPage = {
  id: string;
  createdAt: string;
  image: PageImage;
  words: PageWord[];
  layout: PageLayout;
  sentenceOverride: string | null;
  hasPreviewed: boolean;
  approved: boolean;
  approvedAt: string | null;
};

export type Book = {
  id: string;
  name: string;
  createdAt: string;
  pages: BookPage[];
};

export type BookStats = {
  pages: number;
  approved: number;
  drafts: number;
};

export function createBook(name: string): Book {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    pages: [],
  };
}

export function bookStats(book: Book): BookStats {
  const approved = book.pages.filter((p) => p.approved).length;
  return { pages: book.pages.length, approved, drafts: book.pages.length - approved };
}

/** Insert or replace a page by id, preserving its original createdAt. */
export function upsertBookPage(book: Book, page: BookPage): Book {
  const index = book.pages.findIndex((p) => p.id === page.id);
  if (index === -1) return { ...book, pages: [...book.pages, page] };
  const pages = [...book.pages];
  pages[index] = { ...page, createdAt: pages[index].createdAt };
  return { ...book, pages };
}

/** Move a page one step earlier (-1) or later (+1). No-op at the edges. */
export function moveBookPage(book: Book, pageId: string, direction: -1 | 1): Book {
  const index = book.pages.findIndex((p) => p.id === pageId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= book.pages.length) return book;
  const pages = [...book.pages];
  const [page] = pages.splice(index, 1);
  pages.splice(target, 0, page);
  return { ...book, pages };
}

export function removeBookPage(book: Book, pageId: string): Book {
  return { ...book, pages: book.pages.filter((p) => p.id !== pageId) };
}

export function pagePosition(book: Book, pageId: string): number {
  return book.pages.findIndex((p) => p.id === pageId);
}

/* ---------- persistence (de)serialization ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePage(value: unknown): BookPage | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !isRecord(value.image)) return null;
  if (typeof value.image.src !== "string" || typeof value.image.name !== "string") return null;
  if (!Array.isArray(value.words)) return null;
  return {
    id: value.id,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    image: {
      name: value.image.name,
      src: value.image.src,
      width: typeof value.image.width === "number" ? value.image.width : 0,
      height: typeof value.image.height === "number" ? value.image.height : 0,
    },
    words: value.words as PageWord[],
    layout: value.layout === "spread" ? "spread" : "single",
    sentenceOverride: typeof value.sentenceOverride === "string" ? value.sentenceOverride : null,
    hasPreviewed: Boolean(value.hasPreviewed),
    approved: Boolean(value.approved),
    approvedAt: typeof value.approvedAt === "string" ? value.approvedAt : null,
  };
}

export function parseBooks(raw: string | null): Book[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const books: Book[] = [];
    for (const item of value) {
      if (!isRecord(item)) continue;
      if (typeof item.id !== "string" || typeof item.name !== "string") continue;
      const pages = (Array.isArray(item.pages) ? item.pages : [])
        .map(parsePage)
        .filter((p): p is BookPage => p !== null);
      books.push({
        id: item.id,
        name: item.name,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
        pages,
      });
    }
    return books;
  } catch {
    return [];
  }
}

export function serializeBooks(books: Book[]): string {
  return JSON.stringify(books);
}
