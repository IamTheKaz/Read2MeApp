import { create } from "zustand";
import {
  createBook as buildBook,
  moveBookPage,
  removeBookPage,
  upsertBookPage,
  type Book,
  type BookPage,
} from "@/lib/book-model";
import {
  apiCreateBook,
  apiDeleteBook,
  apiRemovePage,
  apiSetPageOrder,
  apiUpsertPage,
  fetchBooks,
} from "@/lib/api";

/**
 * Books are persisted in the database (Neon, or the PGLite preview fallback).
 * This store holds the client view and pushes every change through the public
 * server functions. Rows are unowned (auth-off), so this is demo-level data.
 */

type BookStore = {
  books: Book[];
  /** Set once the initial load from the server resolves. */
  hydrated: boolean;
  /** Non-null when loading or the last save failed. */
  persistError: string | null;
  activeBookId: string | null;
  hydrate: () => void;
  createBook: (name: string) => string;
  deleteBook: (id: string) => void;
  openBook: (id: string) => void;
  closeBook: () => void;
  upsertPage: (bookId: string, page: BookPage) => void;
  movePage: (bookId: string, pageId: string, direction: -1 | 1) => void;
  removePage: (bookId: string, pageId: string) => void;
};

let saveChain: Promise<unknown> = Promise.resolve();

/** Serialize writes so rapid edits (typing) don't race the server. */
function enqueue(task: () => Promise<unknown>, onError: (message: string) => void) {
  saveChain = saveChain
    .then(task)
    .then(() => undefined)
    .catch(() =>
      onError("Couldn't save — your latest change may not persist. Check the connection."),
    );
}

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  hydrated: false,
  persistError: null,
  activeBookId: null,

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    void fetchBooks()
      .then((books) => set({ books, hydrated: true, persistError: null }))
      .catch(() =>
        set({ persistError: "Couldn't load your books. Is the app running?", hydrated: true }),
      );
  },

  createBook: (name) => {
    const book = buildBook(name);
    set((s) => ({ books: [...s.books, book], activeBookId: book.id, persistError: null }));
    enqueue(() => apiCreateBook(book.id, book.name), (m) => set({ persistError: m }));
    return book.id;
  },

  deleteBook: (id) => {
    set((s) => ({
      books: s.books.filter((b) => b.id !== id),
      activeBookId: s.activeBookId === id ? null : s.activeBookId,
    }));
    enqueue(() => apiDeleteBook(id), (m) => set({ persistError: m }));
  },

  openBook: (id) => {
    if (get().books.some((b) => b.id === id)) set({ activeBookId: id });
  },

  closeBook: () => set({ activeBookId: null }),

  upsertPage: (bookId, page) => {
    set((s) => ({
      books: s.books.map((b) => (b.id === bookId ? upsertBookPage(b, page) : b)),
    }));
    enqueue(() => apiUpsertPage(bookId, page), (m) => set({ persistError: m }));
  },

  movePage: (bookId, pageId, direction) => {
    const book = get().books.find((b) => b.id === bookId);
    if (!book) return;
    const next = moveBookPage(book, pageId, direction);
    set((s) => ({ books: s.books.map((b) => (b.id === bookId ? next : b)) }));
    enqueue(
      () =>
        apiSetPageOrder(
          bookId,
          next.pages.map((p) => p.id),
        ),
      (m) => set({ persistError: m }),
    );
  },

  removePage: (bookId, pageId) => {
    set((s) => ({
      books: s.books.map((b) => (b.id === bookId ? removeBookPage(b, pageId) : b)),
    }));
    enqueue(() => apiRemovePage(pageId), (m) => set({ persistError: m }));
  },
}));

export function useActiveBook(): Book | null {
  return useBookStore((s) => s.books.find((b) => b.id === s.activeBookId) ?? null);
}
