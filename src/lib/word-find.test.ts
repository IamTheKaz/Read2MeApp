import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { PageWord } from "./page-model.ts";
import { clicksMatch, formatFindTime, formatWrongTries, pickTargetWords } from "./word-find.ts";

function word(id: string, text: string): PageWord {
  return {
    id,
    text,
    phonetic: null,
    bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
    confidence: 90,
    confirmed: true,
  };
}

test("pickTargetWords keeps unique spellings and caps at 3–5", () => {
  const words = ["I", "brush", "my", "teeth", "every", "morning", "I"].map((t, i) => word(String(i), t));
  // random() = 0 → shuffle is stable-ish and count = MIN_TARGETS (3)
  const picked = pickTargetWords(words, () => 0);
  assert.equal(picked.length, 3);
  const texts = picked.map((w) => w.text.toLowerCase());
  assert.equal(new Set(texts).size, texts.length);
});

test("pickTargetWords returns every unique word when the page is short", () => {
  const words = [word("1", "Hi"), word("2", "there")];
  const picked = pickTargetWords(words, () => 0.9);
  assert.equal(picked.length, 2);
});

test("clicksMatch ignores punctuation and case", () => {
  assert.equal(clicksMatch(word("a", "Teeth"), word("b", "teeth.")), true);
  assert.equal(clicksMatch(word("a", "my"), word("b", "teeth")), false);
});

test("format helpers match the teacher scores wording", () => {
  assert.equal(formatFindTime(30_000), "30 seconds");
  assert.equal(formatFindTime(10_000), "10 seconds");
  assert.equal(formatFindTime(450), "0.5 seconds");
  assert.equal(formatWrongTries(2), "2 wrong tries");
  assert.equal(formatWrongTries(0), "0 wrong tries");
  assert.equal(formatWrongTries(1), "1 wrong try");
});
