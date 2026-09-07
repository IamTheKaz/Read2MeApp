import { useState } from "react";
import { BookOpen, ChevronRight, Plus, TriangleAlert, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bookStats, type Book } from "@/lib/book-model";
import { useBookStore } from "@/store/book-store";
import { usePageStore } from "@/store/page-store";

export function LibraryView() {
  const books = useBookStore((s) => s.books);
  const hydrated = useBookStore((s) => s.hydrated);
  const persistError = useBookStore((s) => s.persistError);
  const createBook = useBookStore((s) => s.createBook);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const openBook = useBookStore((s) => s.openBook);
  const editorBookId = usePageStore((s) => s.bookId);
  const beginBookPage = usePageStore((s) => s.beginBookPage);
  const openBookPage = usePageStore((s) => s.openBookPage);
  const resetEditor = usePageStore((s) => s.reset);
  const [name, setName] = useState("");

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = createBook(trimmed);
    setName("");
    beginBookPage(id);
  }

  function handleOpen(book: Book) {
    openBook(book.id);
    // Resume where the book is: first page if it has any, otherwise upload.
    const first = book.pages[0];
    if (first) openBookPage(book.id, first.id);
    else beginBookPage(book.id);
  }

  function handleDelete(book: Book) {
    const label = bookStats(book);
    const detail =
      label.pages > 0
        ? ` and its ${label.pages} page${label.pages === 1 ? "" : "s"}`
        : "";
    if (!window.confirm(`Delete “${book.name}”${detail}? This can't be undone.`)) return;
    if (editorBookId === book.id) resetEditor();
    deleteBook(book.id);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-2xl bg-surface p-4 shadow-border sm:p-5">
        <h2 className="font-display text-xl font-medium tracking-tight">Start a new book</h2>
        <p className="mt-1 text-sm text-muted">
          Name it now, add pages one photo at a time — drafts are fine, you can finish later.
        </p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. The Hungry Caterpillar, Week 3 reader"
            aria-label="Book name"
            maxLength={80}
          />
          <Button type="submit" disabled={!name.trim()} className="shrink-0">
            <Plus />
            Create book
          </Button>
        </form>
      </section>

      {persistError && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {persistError}
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl font-medium tracking-tight">Your books</h2>
        {!hydrated ? (
          <p className="mt-4 text-sm text-muted">Loading your books…</p>
        ) : books.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center shadow-border">
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <BookOpen className="size-5" />
            </span>
            <p className="mt-4 font-display text-lg font-medium tracking-tight">No books yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Create your first book above, then photograph pages into it. Each page is reviewed
              and approved on its own — a half-finished book still opens fine.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {books.map((book) => {
              const stats = bookStats(book);
              return (
                <li key={book.id} className="flex flex-col rounded-xl bg-surface p-4 shadow-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-medium tracking-tight">
                        {book.name}
                      </p>
                      <p className="mt-0.5 text-xs text-subtle">
                        Created {new Date(book.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="flex size-9 items-center justify-center rounded-md text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                      aria-label={`Delete ${book.name}`}
                      onClick={() => handleDelete(book)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">
                      {stats.pages} page{stats.pages === 1 ? "" : "s"}
                    </Badge>
                    {stats.approved > 0 && (
                      <Badge>
                        {stats.approved} approved
                      </Badge>
                    )}
                    {stats.drafts > 0 && (
                      <Badge variant="muted">
                        {stats.drafts} draft{stats.drafts === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  <Button className="mt-4 w-full" variant="secondary" onClick={() => handleOpen(book)}>
                    Open book
                    <ChevronRight />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
