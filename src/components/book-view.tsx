import { ArrowLeft, ChevronDown, ChevronUp, LoaderCircle, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageCanvas } from "@/components/page-canvas";
import { ReviewSidebar } from "@/components/review-sidebar";
import { UploadPanel } from "@/components/upload-panel";
import { bookStats, pagePosition, type Book } from "@/lib/book-model";
import { cn } from "@/lib/utils";
import { useBookStore } from "@/store/book-store";
import { usePageStore } from "@/store/page-store";

export function BookView({ book }: { book: Book }) {
  const image = usePageStore((s) => s.image);
  const words = usePageStore((s) => s.words);
  const editorBookId = usePageStore((s) => s.bookId);
  const editorPageId = usePageStore((s) => s.pageId);
  const ocr = usePageStore((s) => s.ocr);
  const beginBookPage = usePageStore((s) => s.beginBookPage);
  const openBookPage = usePageStore((s) => s.openBookPage);
  const resetEditor = usePageStore((s) => s.reset);
  const closeBook = useBookStore((s) => s.closeBook);
  const movePage = useBookStore((s) => s.movePage);
  const removePage = useBookStore((s) => s.removePage);

  const stats = bookStats(book);
  const ocrRunning = ocr.status === "running";
  const editorOpen = image !== null && editorBookId === book.id;
  const currentIndex = editorPageId ? pagePosition(book, editorPageId) : -1;

  function handleBack() {
    resetEditor();
    closeBook();
  }

  function handleRemovePage(pageId: string, index: number) {
    if (!window.confirm(`Remove page ${index + 1} from “${book.name}”?`)) return;
    if (editorPageId === pageId) beginBookPage(book.id);
    removePage(book.id, pageId);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-surface p-4 shadow-border sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft />
            All books
          </Button>
          <div className="min-w-0 flex-1 basis-full order-last sm:order-none sm:basis-auto">
            <h1 className="truncate font-display text-xl font-medium tracking-tight sm:text-2xl">
              {book.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
          </div>
          <Button onClick={() => beginBookPage(book.id)} disabled={ocrRunning} size="sm">
            <Plus />
            Add page
          </Button>
        </div>

        {book.pages.length > 0 && (
          <ol className="mt-4 flex gap-3 overflow-x-auto pb-1" aria-label="Pages in reading order">
            {book.pages.map((page, index) => {
              const active = editorOpen && editorPageId === page.id;
              const reading = ocrRunning && editorPageId === page.id;
              return (
                <li
                  key={page.id}
                  className={cn(
                    "flex w-32 shrink-0 flex-col rounded-lg bg-bg-sunken p-2 transition-shadow sm:w-28",
                    active && "shadow-[0_0_0_2px_var(--color-primary)]",
                  )}
                >
                  <button
                    type="button"
                    className="group relative text-left"
                    onClick={() => openBookPage(book.id, page.id)}
                    disabled={ocrRunning}
                    aria-label={`Open page ${index + 1}`}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="relative block overflow-hidden rounded-sm">
                      <img
                        src={page.image.src}
                        alt={page.image.name}
                        className="h-24 w-full rounded-sm object-cover"
                        draggable={false}
                      />
                      {reading && (
                        <span className="absolute inset-0 flex items-center justify-center bg-fg/40 text-primary-fg">
                          <LoaderCircle className="size-5 animate-spin" />
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-1 text-xs font-medium">
                      Page {index + 1}
                      {page.approved ? (
                        <Badge className="px-1.5 py-0 text-[10px]">Approved</Badge>
                      ) : (
                        <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                          Draft
                        </Badge>
                      )}
                    </span>
                  </button>
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-0.5">
                    <div className="flex">
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-xs text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-30"
                        aria-label={`Move page ${index + 1} earlier`}
                        disabled={index === 0 || ocrRunning}
                        onClick={() => movePage(book.id, page.id, -1)}
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-xs text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-30"
                        aria-label={`Move page ${index + 1} later`}
                        disabled={index === book.pages.length - 1 || ocrRunning}
                        onClick={() => movePage(book.id, page.id, 1)}
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-xs text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                      aria-label={`Remove page ${index + 1}`}
                      onClick={() => handleRemovePage(page.id, index)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {editorOpen ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,22rem)] lg:items-start">
          <section className="overflow-x-auto rounded-2xl bg-surface p-3 shadow-border sm:p-4">
            <PageCanvas />
            {ocr.status === "error" && <p className="mt-3 text-sm text-danger">{ocr.message}</p>}
            {ocr.status === "done" && words.length === 0 && (
              <p className="mt-3 text-sm text-muted">
                Nothing readable was found. Try a sharper photo with higher contrast.
              </p>
            )}
            {ocr.status === "done" && currentIndex !== -1 && (
              <p className="mt-3 text-xs text-subtle">
                Page {currentIndex + 1} of {book.pages.length} — changes save to the book
                automatically.
              </p>
            )}
          </section>
          <ReviewSidebar />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl">
          <UploadPanel />
        </div>
      )}
    </div>
  );
}
