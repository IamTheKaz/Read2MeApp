export type BBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PageWord = {
  id: string;
  text: string;
  rawText?: string;
  phonetic: string | null;
  bbox: BBox;
  confidence: number;
  confirmed: boolean;
};

export type PageLayout = "single" | "spread";

export type SpeechToken = {
  /** Text shown / matched on the page. */
  display: string;
  /** Text sent to TTS (phonetic override when set). */
  speak: string;
  /** Detected box to highlight; null when the spoken word has no on-page match. */
  wordId: string | null;
  start: number;
  end: number;
};

export type PageImage = {
  name: string;
  src: string;
  width: number;
  height: number;
};

export type ApprovedPage = {
  approved: boolean;
  approvedAt: string | null;
  image: {
    name: string;
    width: number;
    height: number;
    reference: string;
  };
  layout: PageLayout;
  sentence: string;
  words: Array<{
    text: string;
    phonetic: string | null;
    position: BBox | null;
    confidence: number | null;
    matchedWordId: string | null;
  }>;
};

export function cleanOcrText(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const inner = trimmed
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}'’-]+$/u, "")
    .trim();
  return inner || trimmed;
}

export function tokenizeSentence(sentence: string): string[] {
  return sentence
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function normalizeToken(value: string): string {
  const matches = value.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu);
  return (matches?.join("") ?? value.toLowerCase()).replace(/[’]/g, "'");
}

/** Cluster by Y, then left-to-right. Spread mode reads the left half fully, then the right. */
export function sortReadingOrder(words: PageWord[], layout: PageLayout, pageWidth: number): PageWord[] {
  if (words.length === 0) return [];
  if (layout === "spread") {
    const mid = pageWidth / 2;
    const left = words.filter((w) => (w.bbox.x0 + w.bbox.x1) / 2 < mid);
    const right = words.filter((w) => (w.bbox.x0 + w.bbox.x1) / 2 >= mid);
    return [...sortLines(left), ...sortLines(right)];
  }
  return sortLines(words);
}

function sortLines(words: PageWord[]): PageWord[] {
  if (words.length === 0) return [];
  const heights = words.map((w) => Math.max(1, w.bbox.y1 - w.bbox.y0)).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] ?? 24;
  const threshold = medianH * 0.65;
  const remaining = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
  const lines: PageWord[][] = [];
  for (const word of remaining) {
    const cy = (word.bbox.y0 + word.bbox.y1) / 2;
    let target: PageWord[] | undefined;
    for (const line of lines) {
      const ly = line.reduce((sum, item) => sum + (item.bbox.y0 + item.bbox.y1) / 2, 0) / line.length;
      if (Math.abs(cy - ly) < threshold) {
        target = line;
        break;
      }
    }
    if (target) target.push(word);
    else lines.push([word]);
  }
  lines.sort((a, b) => {
    const ay = a.reduce((sum, item) => sum + (item.bbox.y0 + item.bbox.y1) / 2, 0) / a.length;
    const by = b.reduce((sum, item) => sum + (item.bbox.y0 + item.bbox.y1) / 2, 0) / b.length;
    return ay - by;
  });
  return lines.flatMap((line) => line.sort((a, b) => a.bbox.x0 - b.bbox.x0));
}

export function getSpokenWordText(word: PageWord): string {
  const baseText = word.phonetic?.trim() || word.text;
  const raw = word.rawText?.trim();
  if (!raw) return baseText;

  const leadingPunct = raw.match(/^[^\p{L}\p{N}]+/u)?.[0] ?? "";
  const trailingPunct = raw.match(/[^\p{L}\p{N}'’-]+$/u)?.[0] ?? "";

  let result = baseText;
  if (leadingPunct && !result.startsWith(leadingPunct)) {
    result = `${leadingPunct}${result}`;
  }
  if (trailingPunct && !result.endsWith(trailingPunct)) {
    result = `${result}${trailingPunct}`;
  }
  return result;
}

export function assembledSentence(words: PageWord[], layout: PageLayout, pageWidth: number): string {
  return sortReadingOrder(words, layout, pageWidth)
    .map((w) => getSpokenWordText(w))
    .join(" ")
    .trim();
}

/**
 * Build a spoken plan. Override text (if any) is the TTS source; detected boxes
 * are matched by spelling so karaoke still lands on the page.
 */
export function buildSpeechPlan(
  words: PageWord[],
  layout: PageLayout,
  pageWidth: number,
  sentenceOverride: string | null,
): { spoken: string; tokens: SpeechToken[]; displaySentence: string } {
  if (sentenceOverride && sentenceOverride.trim()) {
    const tokensIn = tokenizeSentence(sentenceOverride);
    const used = new Set<string>();
    const tokens: SpeechToken[] = [];
    let cursor = 0;
    const ordered = sortReadingOrder(words, layout, pageWidth);
    for (const raw of tokensIn) {
      const key = normalizeToken(raw);
      const match = ordered.find((w) => !used.has(w.id) && normalizeToken(w.text) === key);
      if (match) used.add(match.id);

      let speak: string;
      if (match?.phonetic?.trim()) {
        const leadingPunct = raw.match(/^[^\p{L}\p{N}]+/u)?.[0] ?? "";
        const trailingPunct = raw.match(/[^\p{L}\p{N}'’-]+$/u)?.[0] ?? "";
        const p = match.phonetic.trim();
        let formatted = p;
        if (leadingPunct && !formatted.startsWith(leadingPunct)) {
          formatted = `${leadingPunct}${formatted}`;
        }
        if (trailingPunct && !formatted.endsWith(trailingPunct)) {
          formatted = `${formatted}${trailingPunct}`;
        }
        speak = formatted;
      } else {
        speak = raw;
      }

      const start = cursor;
      const end = start + speak.length;
      tokens.push({
        display: match?.text ?? cleanOcrText(raw),
        speak,
        wordId: match?.id ?? null,
        start,
        end,
      });
      cursor = end + 1;
    }
    const spoken = tokens.map((t) => t.speak).join(" ");
    return { spoken, tokens, displaySentence: tokensIn.join(" ") };
  }

  const ordered = sortReadingOrder(words, layout, pageWidth);
  const tokens: SpeechToken[] = [];
  let cursor = 0;
  for (const word of ordered) {
    const speak = getSpokenWordText(word);
    const start = cursor;
    const end = start + speak.length;
    tokens.push({
      display: word.text,
      speak,
      wordId: word.id,
      start,
      end,
    });
    cursor = end + 1;
  }
  const spoken = tokens.map((t) => t.speak).join(" ");
  const displaySentence = tokens.map((t) => t.speak).join(" ");
  return { spoken, tokens, displaySentence };
}

export function tokenAtChar(tokens: SpeechToken[], charIndex: number): SpeechToken | undefined {
  if (tokens.length === 0) return undefined;
  const hit = tokens.find((t) => charIndex >= t.start && charIndex < t.end);
  if (hit) return hit;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (token && charIndex >= token.start) return token;
  }
  return tokens[0];
}

/** Map audio clock time onto speech tokens once duration is known (after canplaythrough). */
export function tokenAtTime(
  tokens: SpeechToken[],
  currentTime: number,
  duration: number,
): SpeechToken | undefined {
  if (tokens.length === 0) return undefined;
  if (!(duration > 0) || !Number.isFinite(duration)) return tokens[0];
  const last = tokens[tokens.length - 1];
  const lastEnd = Math.max(last?.end ?? 1, 1);
  const t = Math.max(0, currentTime);
  const charPos = (t / duration) * lastEnd;
  return tokenAtChar(tokens, charPos);
}

export function buildApprovedPage(input: {
  image: PageImage;
  words: PageWord[];
  layout: PageLayout;
  sentenceOverride: string | null;
  approvedAt: string;
}): ApprovedPage {
  const plan = buildSpeechPlan(input.words, input.layout, input.image.width, input.sentenceOverride);
  const byId = new Map(input.words.map((w) => [w.id, w]));
  return {
    approved: true,
    approvedAt: input.approvedAt,
    image: {
      name: input.image.name,
      width: input.image.width,
      height: input.image.height,
      reference: `${input.image.name} (in-memory data URL)`,
    },
    layout: input.layout,
    sentence: plan.displaySentence,
    words: plan.tokens.map((token) => {
      const word = token.wordId ? byId.get(token.wordId) : undefined;
      return {
        text: token.display,
        phonetic: word?.phonetic ?? null,
        position: word?.bbox ?? null,
        confidence: word ? Math.round(word.confidence * 10) / 10 : null,
        matchedWordId: token.wordId,
      };
    }),
  };
}
