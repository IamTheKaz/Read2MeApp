import { Check, ListOrdered, Play, Plus, Square, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  assembledSentence,
  buildSpeechPlan,
} from "@/lib/page-model";
import { cn } from "@/lib/utils";
import { useActiveBook } from "@/store/book-store";
import { usePageStore } from "@/store/page-store";

export function ReviewSidebar() {
  const image = usePageStore((s) => s.image);
  const words = usePageStore((s) => s.words);
  const layout = usePageStore((s) => s.layout);
  const setLayout = usePageStore((s) => s.setLayout);
  const sentenceOverride = usePageStore((s) => s.sentenceOverride);
  const showOrderEditor = usePageStore((s) => s.showOrderEditor);
  const setShowOrderEditor = usePageStore((s) => s.setShowOrderEditor);
  const orderDraft = usePageStore((s) => s.orderDraft);
  const setOrderDraft = usePageStore((s) => s.setOrderDraft);
  const applyReadingOrder = usePageStore((s) => s.applyReadingOrder);
  const clearReadingOrder = usePageStore((s) => s.clearReadingOrder);
  const confirmRemaining = usePageStore((s) => s.confirmRemaining);
  const previewSentence = usePageStore((s) => s.previewSentence);
  const stopPlayback = usePageStore((s) => s.stopPlayback);
  const playback = usePageStore((s) => s.playback);
  const hasPreviewed = usePageStore((s) => s.hasPreviewed);
  const approved = usePageStore((s) => s.approved);
  const approve = usePageStore((s) => s.approve);
  const beginBookPage = usePageStore((s) => s.beginBookPage);
  const ocr = usePageStore((s) => s.ocr);
  const ttsAvailable = usePageStore((s) => s.ttsAvailable);
  const activeBook = useActiveBook();

  if (!image) return null;

  const confirmed = words.filter((w) => w.confirmed).length;
  const playingSentence = playback.kind === "sentence";
  const plan = buildSpeechPlan(words, layout, image.width, sentenceOverride);
  const autoSentence = assembledSentence(words, layout, image.width);
  const ready = words.length > 0 && ocr.status === "done";

  return (
    <aside className="flex flex-col gap-4">
      <section className="rounded-xl bg-surface p-4 shadow-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium tracking-tight">Review</h2>
            <p className="mt-1 text-sm text-muted">
              {words.length === 0
                ? ocr.status === "error"
                  ? ocr.message
                  : "Waiting for words on the page."
                : `${confirmed} of ${words.length} words saved`}
            </p>
          </div>
          {approved ? <Badge>Approved</Badge> : hasPreviewed ? <Badge variant="muted">Previewed</Badge> : null}
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-sm bg-bg-sunken p-1">
          <button
            type="button"
            className={cn(
              "h-9 rounded-xs text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
              layout === "single" ? "bg-surface text-fg shadow-border" : "text-muted",
            )}
            onClick={() => setLayout("single")}
          >
            Single page
          </button>
          <button
            type="button"
            className={cn(
              "h-9 rounded-xs text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
              layout === "spread" ? "bg-surface text-fg shadow-border" : "text-muted",
            )}
            onClick={() => setLayout("spread")}
          >
            Two-page spread
          </button>
        </div>

        <p className="mt-3 rounded-md bg-bg-sunken px-3 py-2 text-sm leading-relaxed text-fg">
          {plan.displaySentence || "No sentence yet."}
        </p>
        {sentenceOverride ? (
          <p className="mt-2 text-xs text-muted">Using your retyped reading order as the TTS source.</p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Auto order is top-to-bottom, then left-to-right
            {layout === "spread" ? ", left page then right page" : ""}.
          </p>
        )}

        {!ttsAvailable && (
          <p className="mt-3 text-sm text-danger">This browser has no speech engine. Preview highlighting still runs.</p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {playingSentence ? (
            <Button onClick={stopPlayback} variant="secondary">
              <Square />
              Stop preview
            </Button>
          ) : (
            <Button onClick={previewSentence} disabled={!ready}>
              <Play />
              Preview narration
            </Button>
          )}
          <Button
            variant={showOrderEditor ? "secondary" : "outline"}
            onClick={() => setShowOrderEditor(!showOrderEditor)}
            disabled={!ready}
          >
            <ListOrdered />
            Fix reading order
          </Button>
          {confirmed < words.length && words.length > 0 && (
            <Button variant="ghost" onClick={confirmRemaining}>
              <Check />
              Save remaining spellings
            </Button>
          )}
        </div>
      </section>

      {showOrderEditor && (
        <section className="rounded-xl bg-surface p-4 shadow-border">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-medium tracking-tight">Reading order</h3>
            <Badge variant="outline">Whole sentence</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            Retype the sentence in the order it should be read. Words are matched back to boxes by spelling.
            Unmatched words still play, without a highlight.
          </p>
          <Textarea
            className="mt-3"
            value={orderDraft}
            onChange={(event) => setOrderDraft(event.target.value)}
            aria-label="Correct full sentence"
          />
          <div className="mt-3 flex flex-col gap-2">
            <Button onClick={applyReadingOrder} disabled={!orderDraft.trim()}>
              Use this order
            </Button>
            {sentenceOverride && (
              <Button variant="ghost" onClick={clearReadingOrder}>
                Restore auto order
              </Button>
            )}
          </div>
          {autoSentence && sentenceOverride && (
            <p className="mt-2 text-xs text-subtle">Auto order was: {autoSentence}</p>
          )}
        </section>
      )}

      <section className="rounded-xl bg-surface p-4 shadow-border">
        <h3 className="font-display text-lg font-medium tracking-tight">Approve page</h3>
        <p className="mt-1 text-sm text-muted">
          Marks this page final once the full read-aloud sounds right.
        </p>
        <Button className="mt-3 w-full" onClick={approve} disabled={!ready || !hasPreviewed || approved}>
          {approved ? "Page approved" : "Approve page"}
        </Button>
        {!hasPreviewed && (
          <p className="mt-2 text-xs text-muted">Preview the narration at least once before approving.</p>
        )}
        {approved && activeBook && (
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => beginBookPage(activeBook.id)}
          >
            <Plus />
            Add next page
          </Button>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-subtle">
        <Volume2 className="mt-0.5 size-3.5 shrink-0" />
        Tap a word on the page to hear it alone and fix spelling or sound. Use Preview narration for the full
        sentence in context.
      </p>
    </aside>
  );
}
