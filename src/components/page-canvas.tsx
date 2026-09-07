import { useMemo, type CSSProperties } from "react";
import { LoaderCircle } from "lucide-react";
import { WordPopover } from "@/components/word-popover";
import { usePageStore } from "@/store/page-store";

export function PageCanvas() {
  const image = usePageStore((s) => s.image);
  const words = usePageStore((s) => s.words);
  const ocr = usePageStore((s) => s.ocr);
  const selectedId = usePageStore((s) => s.selectedId);
  const playback = usePageStore((s) => s.playback);
  const editorMode = usePageStore((s) => s.editorMode);
  const selectWord = usePageStore((s) => s.selectWord);

  const selected = useMemo(
    () => words.find((w) => w.id === selectedId) ?? null,
    [words, selectedId],
  );

  if (!image) return null;

  const running = ocr.status === "running";
  const popoverBelow = selected
    ? selected.bbox.y1 < image.height * 0.62
    : true;
  // Desktop-only anchored popover placement (percentage of the image).
  const popoverStyle: CSSProperties | undefined = selected
    ? {
        left: `${Math.min(58, Math.max(1, (selected.bbox.x0 / image.width) * 100))}%`,
        top: popoverBelow
          ? `${(selected.bbox.y1 / image.height) * 100}%`
          : `${(selected.bbox.y0 / image.height) * 100}%`,
        transform: popoverBelow ? "translateY(8px)" : "translateY(calc(-100% - 8px))",
      }
    : undefined;

  return (
    <div className="relative">
      <div
        className="relative inline-block max-w-full touch-manipulation select-none"
        onPointerDown={() => {
          if (!running) selectWord(null, false);
        }}
      >
        <img
          src={image.src}
          alt={image.name}
          className="block h-auto max-h-[min(72vh,760px)] w-auto max-w-full rounded-md bg-surface-2"
          draggable={false}
        />

        {image.width > 0 &&
          words.map((word) => {
            const left = (word.bbox.x0 / image.width) * 100;
            const top = (word.bbox.y0 / image.height) * 100;
            const width = ((word.bbox.x1 - word.bbox.x0) / image.width) * 100;
            const height = ((word.bbox.y1 - word.bbox.y0) / image.height) * 100;
            const selectedBox = word.id === selectedId;
            const karaoke = playback.kind === "sentence" && playback.wordId === word.id;
            const wordPlay = playback.kind === "word" && playback.wordId === word.id;
            return (
              <button
                key={word.id}
                type="button"
                className="word-box min-h-4 min-w-4"
                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                data-confirmed={word.confirmed ? "true" : "false"}
                data-selected={selectedBox ? "true" : "false"}
                data-karaoke={karaoke || wordPlay ? "true" : "false"}
                aria-label={`Word: ${word.text}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  selectWord(word.id, true);
                }}
              />
            );
          })}

        {selected && image.width > 0 && (
          <>
            {/* Phones: editing a word needs room, so dock it as a bottom sheet
                above a light scrim instead of a cramped popover over the page. */}
            <div
              className="fixed inset-0 z-30 bg-fg/30 sm:hidden"
              onPointerDown={() => selectWord(null, false)}
              aria-hidden="true"
            />
            <div
              className="fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:contents"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div
                className="sm:absolute sm:z-20 sm:w-[min(18.5rem,calc(100%-0.5rem))]"
                style={popoverStyle}
              >
                <WordPopover word={selected} />
              </div>
            </div>
          </>
        )}

        {running && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-fg/40">
            <div className="mx-4 w-72 rounded-lg bg-surface p-4 shadow-border">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                {ocr.message || "Reading the page"}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-sunken">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.round(ocr.progress * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">First run downloads the reading engine.</p>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <p className="mt-3 text-sm text-muted">
          {editorMode === "pronunciation" ? (
            <>
              Fixing <span className="font-medium text-fg">pronunciation</span> for “{selected.text}”.
              Spelling on the page stays the same.
            </>
          ) : (
            <>
              Fixing <span className="font-medium text-fg">spelling</span> for this word. Tap Sound if it
              is spelled right but spoken wrong.
            </>
          )}
        </p>
      )}
    </div>
  );
}
