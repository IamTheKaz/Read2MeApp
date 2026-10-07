import { useRef, useState } from "react";
import { BookOpen, ChevronRight, FileText, Plus, TriangleAlert, Trash2 } from "lucide-react";
import { TeacherAdmin } from "@/components/teacher-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bookStats, type Book } from "@/lib/book-model";
import { bookNameFromPdf, MAX_PDF_PAGES } from "@/lib/pdf-pages";
import { cn } from "@/lib/utils";
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
  const importPdf = usePageStore((s) => s.importPdf);
  const importJob = usePageStore((s) => s.importJob);
  const [name, setName] = useState("");
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const importing = importJob.status === "running" || pdfBusy;

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = createBook(trimmed);
    setName("");
    beginBookPage(id);
  }

  async function handlePdf(file: File | undefined) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) return;
    setPdfBusy(true);
    try {
      const id = createBook(bookNameFromPdf(file));
      beginBookPage(id);
      await importPdf(file);
    } finally {
      setPdfBusy(false);
    }
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
          Name it and add pages one photo at a time, or import a whole PDF. Drafts are fine — you can
          finish later.
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
            disabled={importing}
          />
          <Button type="submit" disabled={!name.trim() || importing} className="shrink-0">
            <Plus />
            Create book
          </Button>
        </form>

        <div
          className={cn(
            "mt-4 rounded-xl bg-bg-sunken p-4 transition-[background-color] duration-150",
            dragOver && "bg-primary-soft",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            void handlePdf(event.dataTransfer.files[0]);
          }}
        >
          <p className="text-sm font-medium">Or upload a PDF of the whole book</p>
          <p className="mt-1 text-xs text-muted">
            Each PDF page becomes a draft (up to {MAX_PDF_PAGES}). Review words, then approve.
          </p>
          {importing && (
            <div className="mt-3">
              <p className="text-sm text-primary">{importJob.message || "Importing PDF…"}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full bg-primary transition-[width] duration-200"
                  style={{ width: `${Math.round(Math.min(1, importJob.progress) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {importJob.status === "error" && (
            <p className="mt-3 text-sm text-danger">{importJob.message}</p>
          )}
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full bg-surface sm:w-auto"
            disabled={importing}
            onClick={() => pdfRef.current?.click()}
          >
            <FileText />
            {importing ? "Importing PDF…" : "Choose PDF"}
          </Button>
          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              void handlePdf(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
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
              Create a book above or import a PDF. Each page is reviewed and approved on its own — a
              half-finished book still opens fine.
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
                    {stats.approved > 0 && <Badge>{stats.approved} approved</Badge>}
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

      <TeacherAdmin />
    </div>
  );
}
