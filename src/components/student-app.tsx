import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Play,
  Repeat2,
  Search,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Book, BookPage } from "@/lib/book-model";
import { apiRecordWordFind, fetchBooks } from "@/lib/api";
import { buildSpeechPlan, getSpokenWordText, normalizeToken, type PageWord } from "@/lib/page-model";
import { cancelSpeech, speakText } from "@/lib/tts";
import { clicksMatch, findPrompt, pickTargetWords } from "@/lib/word-find";

type Phase = "loading" | "pick" | "name" | "read";

type FindRound = {
  pageId: string;
  targets: PageWord[];
  current: number;
  found: string[];
  wrong: number;
  promptAt: number;
  missId: string | null;
};

export function StudentApp() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [books, setBooks] = useState<Book[]>([]);
  const [book, setBook] = useState<Book | null>(null);
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [finishedPages, setFinishedPages] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [round, setRound] = useState<FindRound | null>(null);
  const roundRef = useRef<FindRound | null>(null);
  const speechGen = useRef(0);
  const missTimer = useRef<number | null>(null);

  roundRef.current = round;

  useEffect(() => {
    void fetchBooks()
      .then((b) => setBooks(b.filter((x) => x.pages.length > 0)))
      .catch(() => setBooks([]))
      .finally(() => setPhase("pick"));
    return () => cancelSpeech();
  }, []);

  const pages = useMemo(() => book?.pages ?? [], [book]);
  const page: BookPage | null = pages[pageIndex] ?? null;
  const plan = useMemo(
    () => (page ? buildSpeechPlan(page.words, page.layout, page.image.width, page.sentenceOverride) : null),
    [page],
  );

  const allDone = book !== null && book.pages.length > 0 && finishedPages.size >= book.pages.length;

  function applyRound(next: FindRound) {
    roundRef.current = next;
    setRound(next);
  }

  function bumpSpeech() {
    speechGen.current += 1;
    cancelSpeech();
    return speechGen.current;
  }

  function markPageDone(id: string) {
    setFinishedPages((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function unmarkPage(id: string) {
    setFinishedPages((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function chooseBook(b: Book) {
    setBook(b);
    setPhase("name");
  }

  function startReading() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setName(trimmed);
    setPageIndex(0);
    setFinishedPages(new Set());
    setRound(null);
    setPhase("read");
  }

  function stopNarration() {
    setPlaying(false);
    setActiveWordId(null);
  }

  function goTo(index: number) {
    bumpSpeech();
    stopNarration();
    setPageIndex(Math.max(0, Math.min(pages.length - 1, index)));
  }

  useEffect(() => {
    if (phase !== "read" || !page) return;
    if (missTimer.current !== null) {
      window.clearTimeout(missTimer.current);
      missTimer.current = null;
    }
    const targets = pickTargetWords(page.words);
    const next: FindRound = {
      pageId: page.id,
      targets,
      current: 0,
      found: [],
      wrong: 0,
      promptAt: Date.now(),
      missId: null,
    };
    applyRound(next);
    if (targets.length === 0) {
      markPageDone(page.id);
      return;
    }
    const gen = bumpSpeech();
    const handle = speakText(findPrompt(targets[0]!), { rate: 0.85 });
    void handle.done.then(() => {
      if (speechGen.current !== gen) return;
    });
    return () => {
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, page?.id]);

  function playNarration() {
    if (!page || !plan || !plan.spoken) return;
    const gen = bumpSpeech();
    setPlaying(true);
    const handle = speakText(plan.spoken, {
      rate: 0.5,
      tokens: plan.tokens,
      onToken: (t) => setActiveWordId(t.wordId),
    });
    void handle.done.then(() => {
      if (speechGen.current !== gen) return;
      stopNarration();
      const r = roundRef.current;
      if (r && r.current < r.targets.length) {
        const target = r.targets[r.current];
        if (target) speakText(findPrompt(target), { rate: 0.85 });
      }
    });
  }

  function stop() {
    bumpSpeech();
    stopNarration();
  }

  function repeatPrompt() {
    const r = roundRef.current;
    if (!r || r.current >= r.targets.length) return;
    const target = r.targets[r.current];
    if (!target) return;
    bumpSpeech();
    stopNarration();
    speakText(findPrompt(target), { rate: 0.85 });
  }

  function onWordClick(word: PageWord) {
    const r = roundRef.current;
    const gen = bumpSpeech();
    stopNarration();
    setActiveWordId(word.id);

    const speakClicked = () => speakText(getSpokenWordText(word), { rate: 0.7 });

    if (!r || r.current >= r.targets.length) {
      speakClicked();
      return;
    }

    const target = r.targets[r.current]!;
    const foundNorms = new Set(
      r.found
        .map((id) => r.targets.find((t) => t.id === id)?.text ?? "")
        .map((t) => normalizeToken(t))
        .filter(Boolean),
    );
    if (foundNorms.has(normalizeToken(word.text))) {
      speakClicked();
      return;
    }

    if (clicksMatch(word, target)) {
      const timeMs = Math.max(0, Date.now() - r.promptAt);
      const wrongClicks = r.wrong;
      const nextFound = [...r.found, target.id];
      const nextIndex = r.current + 1;
      const complete = nextIndex >= r.targets.length;
      applyRound({
        ...r,
        found: nextFound,
        current: nextIndex,
        wrong: 0,
        promptAt: Date.now(),
        missId: null,
      });
      if (complete) markPageDone(r.pageId);
      if (book) {
        void apiRecordWordFind({
          studentName: name,
          bookId: book.id,
          pageId: r.pageId,
          pagePosition: pageIndex,
          wordId: target.id,
          wordText: target.text,
          timeMs,
          wrongClicks,
        }).catch(() => undefined);
      }
      void (async () => {
        await speakClicked().done;
        if (speechGen.current !== gen) return;
        if (!complete) {
          const nextTarget = r.targets[nextIndex];
          if (nextTarget) speakText(findPrompt(nextTarget), { rate: 0.85 });
        }
      })();
      return;
    }

    applyRound({ ...r, wrong: r.wrong + 1, missId: word.id });
    if (missTimer.current !== null) window.clearTimeout(missTimer.current);
    missTimer.current = window.setTimeout(() => {
      setRound((prev) => (prev && prev.missId === word.id ? { ...prev, missId: null } : prev));
      missTimer.current = null;
    }, 420);

    void (async () => {
      await speakClicked().done;
      if (speechGen.current !== gen) return;
      await speakText("Try again.", { rate: 0.95 }).done;
      if (speechGen.current !== gen) return;
      speakText(findPrompt(target), { rate: 0.85 });
    })();
  }

  function restart() {
    bumpSpeech();
    stopNarration();
    setBook(null);
    setName("");
    setNameInput("");
    setFinishedPages(new Set());
    setPageIndex(0);
    setRound(null);
    setPhase("pick");
  }

  if (phase === "loading") {
    return <CenteredNote>Loading books…</CenteredNote>;
  }

  if (phase === "pick") {
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" />
          Home
        </Link>
        <p className="text-center font-display text-3xl font-medium tracking-tight">Pick a book to read</p>
        <p className="mt-2 text-center text-muted">Tap a book, type your name, and find the words.</p>
        {books.length === 0 ? (
          <p className="mt-10 rounded-2xl bg-surface px-6 py-12 text-center text-muted shadow-border">
            No books are ready yet. Ask your teacher to add some pages.
          </p>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {books.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => chooseBook(b)}
                  className="flex w-full items-center gap-3 rounded-xl bg-surface p-4 text-left shadow-border transition-shadow hover:shadow-md"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <BookOpen className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg font-medium tracking-tight">{b.name}</span>
                    <span className="text-sm text-muted">
                      {b.pages.length} page{b.pages.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (phase === "name" && book) {
    return (
      <div className="mx-auto flex max-w-md flex-col justify-center pt-4">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" />
          Home
        </Link>
        <div className="rounded-2xl bg-surface p-6 shadow-border sm:p-8">
          <h1 className="font-display text-2xl font-medium tracking-tight">What’s your name?</h1>
          <p className="mt-2 text-sm text-muted">
            Your teacher uses it to see which words you found in “{book.name}”.
          </p>
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              startReading();
            }}
          >
            <Input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Type your first name"
              aria-label="Your name"
              maxLength={40}
            />
            <Button type="submit" disabled={!nameInput.trim()}>
              <Play />
              Start reading
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPhase("pick")}>
              <ArrowLeft />
              Pick a different book
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (phase === "read" && book && page) {
    const pageComplete = finishedPages.has(page.id);
    const targetCount = round?.targets.length ?? 0;
    const wordsFound = round?.found.length ?? 0;
    const currentTarget = round && round.current < round.targets.length ? round.targets[round.current] : null;
    const foundNorms = new Set(
      (round?.found ?? [])
        .map((id) => round?.targets.find((t) => t.id === id)?.text ?? "")
        .map((t) => normalizeToken(t))
        .filter(Boolean),
    );

    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={restart}>
            <ArrowLeft />
            Done
          </Button>
          <Badge variant="muted">
            <Search className="mr-1 size-3" />
            {wordsFound}/{targetCount} words
          </Badge>
        </div>

        <h1 className="mt-4 text-center font-display text-2xl font-medium tracking-tight">{book.name}</h1>
        <p className="mt-1 text-center text-sm text-muted">
          Reading as {name} · Page {pageIndex + 1} of {pages.length}
        </p>

        <div className="mx-auto mt-4 max-w-2xl rounded-xl bg-surface px-4 py-3 shadow-border">
          {currentTarget ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="text-center font-display text-xl font-medium tracking-tight">
                Find the word{" "}
                <span className="text-primary">{currentTarget.text}</span>
              </p>
              <Button type="button" variant="outline" size="sm" onClick={repeatPrompt} aria-label="Repeat the prompt">
                <Repeat2 />
                Repeat
              </Button>
            </div>
          ) : targetCount === 0 ? (
            <p className="text-center text-sm text-muted">No words on this page — Next is unlocked.</p>
          ) : (
            <p className="text-center font-display text-lg font-medium tracking-tight text-primary">
              You found every word on this page. Next is unlocked.
            </p>
          )}
        </div>

        <div className="relative mx-auto mt-5 max-w-2xl">
          <div className="relative inline-block max-w-full touch-manipulation select-none">
            <img
              src={page.image.src}
              alt={`Page ${pageIndex + 1}`}
              className="block h-auto max-h-[min(60vh,640px)] w-auto max-w-full rounded-md bg-surface-2"
              draggable={false}
            />
            {page.image.width > 0 &&
              page.words.map((w) => {
                const left = (w.bbox.x0 / page.image.width) * 100;
                const top = (w.bbox.y0 / page.image.height) * 100;
                const width = ((w.bbox.x1 - w.bbox.x0) / page.image.width) * 100;
                const height = ((w.bbox.y1 - w.bbox.y0) / page.image.height) * 100;
                const karaoke = activeWordId === w.id;
                const found = foundNorms.has(normalizeToken(w.text));
                const miss = round?.missId === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    className="word-box"
                    data-clickable="true"
                    data-karaoke={karaoke ? "true" : "false"}
                    data-found={found ? "true" : "false"}
                    data-miss={miss ? "true" : "false"}
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                    aria-label={w.text}
                    onClick={() => onWordClick(w)}
                  />
                );
              })}
          </div>
        </div>

        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              unmarkPage(page.id);
              goTo(pageIndex - 1);
            }}
            disabled={pageIndex === 0}
          >
            <ChevronLeft />
            Back
          </Button>
          {playing ? (
            <Button variant="secondary" onClick={stop} className="min-w-36">
              <Square />
              Stop
            </Button>
          ) : (
            <Button onClick={playNarration} className="min-w-36" variant="secondary">
              <Play />
              Read to me
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => goTo(pageIndex + 1)}
            disabled={!pageComplete || pageIndex === pages.length - 1}
            title={!pageComplete ? "Find all the words first" : undefined}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
        {!pageComplete && targetCount > 0 && (
          <p className="mt-2 text-center text-sm text-muted">Find each word before Next unlocks.</p>
        )}

        {allDone && (
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-primary-soft p-6 text-center">
            <p className="font-display text-2xl font-medium tracking-tight text-primary">You finished the book!</p>
            <p className="mt-1 text-sm text-primary">Great finding, {name}.</p>
            <Button className="mt-4" variant="secondary" onClick={restart}>
              Read another book
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md items-center justify-center">
      <p className="text-muted">{children}</p>
    </div>
  );
}
