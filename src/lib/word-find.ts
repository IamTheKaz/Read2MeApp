import { normalizeToken, type PageWord } from "./page-model.ts";

const MIN_TARGETS = 3;
const MAX_TARGETS = 5;
export const MAX_FOCUS_WORDS = 12;

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

/** Unique cleaned spellings, in the order they appeared. */
export function uniqueWordTexts(texts: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of texts) {
    const display = raw.replace(/\s+/g, " ").trim();
    const key = normalizeToken(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
    if (out.length >= MAX_FOCUS_WORDS) break;
  }
  return out;
}

/**
 * Map a teacher-chosen spelling list onto on-page boxes. Skips spellings that
 * don't appear on the page instead of failing.
 */
export function resolveFocusTargets(words: PageWord[], focusTexts: string[]): PageWord[] {
  const used = new Set<string>();
  const result: PageWord[] = [];
  for (const raw of uniqueWordTexts(focusTexts)) {
    const key = normalizeToken(raw);
    const hit = words.find((w) => !used.has(w.id) && normalizeToken(w.text) === key);
    if (!hit) continue;
    used.add(hit.id);
    result.push(hit);
  }
  return result;
}

export function isFocusText(focusTexts: string[], text: string): boolean {
  const key = normalizeToken(text);
  if (!key) return false;
  return focusTexts.some((t) => normalizeToken(t) === key);
}

/**
 * If the teacher set focus words, use the ones that appear on this page (in
 * that order). Otherwise unique spellings, shuffled, then 3–5 of them.
 */
export function pickTargetWords(
  words: PageWord[],
  random: () => number = Math.random,
  focusTexts: string[] = [],
): PageWord[] {
  if (focusTexts.length > 0) {
    const focused = resolveFocusTargets(words, focusTexts);
    if (focused.length > 0) return focused;
  }
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
