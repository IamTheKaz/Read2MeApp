import { normalizeToken, type PageWord } from "./page-model.ts";

const MIN_TARGETS = 3;
const MAX_TARGETS = 5;

function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

/** Unique spellings, shuffled, then 3–5 of them (or all, if the page is short). */
export function pickTargetWords(words: PageWord[], random: () => number = Math.random): PageWord[] {
  const unique: PageWord[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const key = normalizeToken(word.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }
  const shuffled = shuffle(unique, random);
  if (shuffled.length <= MIN_TARGETS) return shuffled;
  const max = Math.min(MAX_TARGETS, shuffled.length);
  const count = MIN_TARGETS + Math.floor(random() * (max - MIN_TARGETS + 1));
  return shuffled.slice(0, count);
}

export function clicksMatch(clicked: PageWord, target: PageWord): boolean {
  const a = normalizeToken(clicked.text);
  const b = normalizeToken(target.text);
  return Boolean(a) && a === b;
}

export function findPrompt(word: PageWord): string {
  return `Find the word ${word.text}.`;
}

export function formatFindTime(ms: number): string {
  const sec = Math.max(0, ms) / 1000;
  const rounded = sec >= 10 ? Math.round(sec) : Math.round(sec * 10) / 10;
  if (rounded === 1) return "1 second";
  return `${rounded} seconds`;
}

export function formatWrongTries(n: number): string {
  if (n === 1) return "1 wrong try";
  return `${n} wrong tries`;
}
