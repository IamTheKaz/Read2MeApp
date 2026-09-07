import { useRef, useState } from "react";
import { BookOpen, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveBook } from "@/store/book-store";
import { usePageStore } from "@/store/page-store";

export function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadFile = usePageStore((s) => s.loadFile);
  const loadSample = usePageStore((s) => s.loadSample);
  const ocr = usePageStore((s) => s.ocr);
  const activeBook = useActiveBook();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<"file" | "sample" | null>(null);

  async function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy("file");
    try {
      await loadFile(file);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-stretch gap-4">
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
          onClick={() => inputRef.current?.click()}
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
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <Button
        variant="outline"
        className="w-full"
        disabled={busy !== null || ocr.status === "running"}
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
