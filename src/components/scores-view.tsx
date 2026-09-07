import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchWordFinds } from "@/lib/api";
import { compareTimestamps } from "@/lib/timestamps";
import { formatFindTime, formatWrongTries } from "@/lib/word-find";
import type { StudentBookFinds, WordFind } from "@/server/scores";

export function ScoresView({ onBack }: { onBack: () => void }) {
  const [scores, setScores] = useState<StudentBookFinds[] | null>(null);
  const [error, setError] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    void fetchWordFinds()
      .then(setScores)
      .catch(() => setError(true));
  }, []);

  const studentCount = scores ? new Set(scores.map((s) => s.studentName)).size : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft />
          Library
        </Button>
        <h1 className="font-display text-2xl font-medium tracking-tight">Student scores</h1>
      </div>
      <p className="mt-2 text-sm text-muted">
        Per-word finds: time to tap each target and wrong tries. Names are typed by the student — no
        accounts.
      </p>

      {scores === null && !error && <p className="mt-8 text-sm text-muted">Loading scores…</p>}
      {error && <p className="mt-8 text-sm text-danger">Couldn't load scores. Please try again.</p>}

      {scores !== null && scores.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center shadow-border">
          <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Users className="size-6" />
          </span>
          <p className="mt-4 font-display text-lg font-medium tracking-tight">No finding yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Once a student finds words on the reading link, each word’s time and wrong tries show up
            here.
          </p>
        </div>
      )}

      {scores && scores.length > 0 && (
        <>
          <p className="mt-6 text-sm text-muted">
            {studentCount} student{studentCount === 1 ? "" : "s"} · {scores.length} book
            {scores.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-3 grid gap-3">
            {scores.map((s) => {
              const key = `${s.studentName}:${s.bookId}`;
              const open = openKey === key;
              return (
                <li key={key} className="rounded-xl bg-surface shadow-border">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left"
                    onClick={() => setOpenKey(open ? null : key)}
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown className="size-4 shrink-0 text-muted" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-medium tracking-tight">
                        {s.studentName}
                      </p>
                      <p className="truncate text-sm text-muted">{s.bookName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default">
                        <Search className="mr-1 size-3" />
                        {s.wordCount} word{s.wordCount === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="muted">
                        {new Set(s.finds.map((f) => f.pageId)).size}/{s.pageCount} pages
                      </Badge>
                    </div>
                  </button>
                  {open && <WordBreakdown finds={s.finds} />}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function WordBreakdown({ finds }: { finds: WordFind[] }) {
  const byPage = new Map<number, WordFind[]>();
  for (const find of finds) {
    const list = byPage.get(find.pagePosition) ?? [];
    list.push(find);
    byPage.set(find.pagePosition, list);
  }
  const pages = [...byPage.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="border-t border-border px-4 py-3">
      <ul className="grid gap-3">
        {pages.map(([position, words]) => {
          const ordered = [...words].sort((a, b) => compareTimestamps(a.foundAt, b.foundAt));
          return (
            <li key={position}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Page {position + 1}
              </p>
              <p className="mt-1 text-sm leading-relaxed">
                {ordered
                  .map(
                    (w) =>
                      `${w.wordText} – ${formatFindTime(w.timeMs)}, ${formatWrongTries(w.wrongClicks)}`,
                  )
                  .join("; ")}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
