import { useEffect, useRef } from "react";
import { Check, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PageWord } from "@/lib/page-model";
import { usePageStore, type EditorMode } from "@/store/page-store";

export function WordPopover({ word }: { word: PageWord }) {
  const editorMode = usePageStore((s) => s.editorMode);
  const playback = usePageStore((s) => s.playback);
  const setEditorMode = usePageStore((s) => s.setEditorMode);
  const updateSpelling = usePageStore((s) => s.updateSpelling);
  const confirmWord = usePageStore((s) => s.confirmWord);
  const setPhonetic = usePageStore((s) => s.setPhonetic);
  const playWord = usePageStore((s) => s.playWord);
  const spellingRef = useRef<HTMLInputElement>(null);
  const soundRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (editorMode === "spelling") spellingRef.current?.focus();
      else soundRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(handle);
  }, [editorMode, word.id]);

  const playingThis = playback.kind !== "idle" && playback.wordId === word.id;

  return (
    <div
      className="w-[min(18.5rem,calc(100vw-2rem))] rounded-lg bg-surface p-3 shadow-border"
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label={editorMode === "spelling" ? "Fix spelling" : "Fix pronunciation"}
    >
      <ModeSwitch mode={editorMode} onChange={setEditorMode} />

      {editorMode === "spelling" ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-muted">On-page spelling</p>
          <Input
            ref={spellingRef}
            value={word.text}
            aria-label="Word spelling"
            onChange={(event) => updateSpelling(word.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmWord(word.id);
              }
            }}
          />
          <Button
            className="w-full"
            size="sm"
            onClick={() => confirmWord(word.id)}
          >
            <Check />
            {word.confirmed ? "Spelling saved" : "Save spelling"}
          </Button>
          <button
            type="button"
            className="w-full py-1 text-xs font-medium text-muted hover:text-fg"
            onClick={() => setEditorMode("pronunciation")}
          >
            Doesn't sound right
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-muted">How it should sound</p>
          <Input
            ref={soundRef}
            value={word.phonetic ?? ""}
            placeholder={`e.g. a respelling of “${word.text}”`}
            aria-label="Phonetic respelling"
            onChange={(event) => setPhonetic(word.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                playWord(word.id);
              }
            }}
          />
          <p className="text-xs leading-snug text-subtle">
            Display stays “{word.text}”. Only the spoken audio changes.
          </p>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={() => playWord(word.id)}
      >
        <Volume2 />
        {playingThis ? "Playing…" : editorMode === "pronunciation" ? "Play sound" : "Play this word"}
      </Button>
    </div>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 rounded-sm bg-bg-sunken p-1"
      role="tablist"
      aria-label="What to fix"
    >
      <ModeTab
        active={mode === "spelling"}
        onClick={() => onChange("spelling")}
        label="Spelling"
      />
      <ModeTab
        active={mode === "pronunciation"}
        onClick={() => onChange("pronunciation")}
        label="Sound"
      />
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-8 rounded-xs text-xs font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
        active ? "bg-surface text-fg shadow-border" : "text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
