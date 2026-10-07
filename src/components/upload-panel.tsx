import { useRef, useState } from "react";
import { BookOpen, FileText, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_PDF_PAGES } from "@/lib/pdf-pages";
import { useActiveBook } from "@/store/book-store";
import { usePageStore } from "@/store/page-store";

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function UploadPanel() {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const loadFile = usePageStore((s) => s.loadFile);
  const loadSample = usePageStore((s) => s.loadSample);
  const importPdf = usePageStore((s) => s.importPdf);
  const ocr = usePageStore((s) => s.ocr);
  const importJob = usePageStore((s) => s.importJob);
  const activeBook = useActiveBook();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<"file" | "sample" | "pdf" | null>(null);

  const importing = importJob.status === "running" || busy === "pdf";

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (isPdf(file)) {
      if (!activeBook) return;
      setBusy("pdf");
      try {
        await importPdf(file);
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!file.type.startsWith("image/")) return;
    setBusy("file");
    try {
      await loadFile(file);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-stretch gap-4">
      {importing && (
        <div className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
          <p className="font-medium">{importJob.message || "Importing PDF…"}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round(Math.min(1, importJob.progress) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {importJob.status === "error" && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{importJob.message}</p>
      )}
      <div
        className={cn(
          "rounded-2xl bg-surface p-3 shadow-border transition-[box-shadow,background-color] duration-200 ease-out",
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
          void onFile(event.dataTransfer.files[0]);
        }}
      >
        <button
          type="button"
          className="flex min-h-56 w-full flex-col items-center justify-center rounded-xl bg-bg-sunken px-6 py-10 text-center"
          onClick={() => imageInputRef.current?.click()}
          disabled={importing}
        >
          <span className="flex size-12 items-center justify-center rounded-lg bg-surface text-primary shadow-border">
            <ImagePlus className="size-5" />
          </span>
          <span className="mt-4 font-display text-2xl font-medium tracking-tight">
            {activeBook ? `Add a page to “${activeBook.name}”` : "Upload a book page"}
          </span>
          <span className="mt-2 max-w-sm text-sm text-muted">
            {activeBook
              ? "A photo of one page or a two-page spread. It lands at the end of the book — you can reorder pages afterwards."
              : "A photo of one page or a two-page spread. Words are detected automatically and laid on the image."}
          </span>
          <span className="mt-5 inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg">
            Choose image
          </span>
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      {activeBook && (
        <Button
          variant="outline"
          className="w-full"
          disabled={busy !== null || ocr.status === "running" || importing}
          onClick={() => pdfInputRef.current?.click()}
        >
          <FileText />
          {importing ? "Importing PDF…" : "Upload a PDF of the whole book"}
        </Button>
      )}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {activeBook && (
        <p className="text-center text-xs text-subtle">
          PDFs become one draft page each (up to {MAX_PDF_PAGES}). Review words, then approve.
        </p>
      )}

      <Button
        variant="outline"
        className="w-full"
        disabled={busy !== null || ocr.status === "running" || importing}
        onClick={() => {
          setBusy("sample");
          void loadSample().finally(() => setBusy(null));
        }}
      >
        <BookOpen />
        {busy === "sample" ? "Loading sample…" : "Try a sample page"}
      </Button>
    </div>
  );
}
