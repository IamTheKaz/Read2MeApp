import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  assembledSentence,
  buildSpeechPlan,
  getSpokenWordText,
  type PageWord,
} from "./page-model.ts";

test("getSpokenWordText preserves punctuation from rawText", () => {
  const word1: PageWord = {
    id: "1",
    text: "morning",
    rawText: "morning.",
    phonetic: null,
    bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
    confidence: 90,
    confirmed: false,
  };
  assert.equal(getSpokenWordText(word1), "morning.");

  const word2: PageWord = {
    id: "2",
    text: "morning",
    rawText: "morning.",
    phonetic: "morn-ing",
    bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
    confidence: 90,
    confirmed: false,
  };
  assert.equal(getSpokenWordText(word2), "morn-ing.");
});

test("assembledSentence joins words with punctuation preserved", () => {
  const words: PageWord[] = [
    { id: "1", text: "I", rawText: "I", phonetic: null, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 90, confirmed: false },
    { id: "2", text: "brush", rawText: "brush", phonetic: null, bbox: { x0: 12, y0: 0, x1: 20, y1: 10 }, confidence: 90, confirmed: false },
    { id: "3", text: "my", rawText: "my", phonetic: null, bbox: { x0: 22, y0: 0, x1: 30, y1: 10 }, confidence: 90, confirmed: false },
    { id: "4", text: "teeth", rawText: "teeth", phonetic: null, bbox: { x0: 32, y0: 0, x1: 40, y1: 10 }, confidence: 90, confirmed: false },
    { id: "5", text: "every", rawText: "every", phonetic: null, bbox: { x0: 42, y0: 0, x1: 50, y1: 10 }, confidence: 90, confirmed: false },
    { id: "6", text: "morning", rawText: "morning.", phonetic: null, bbox: { x0: 52, y0: 0, x1: 60, y1: 10 }, confidence: 90, confirmed: false },
    { id: "7", text: "I", rawText: "I", phonetic: null, bbox: { x0: 62, y0: 0, x1: 70, y1: 10 }, confidence: 90, confirmed: false },
    { id: "8", text: "put", rawText: "put", phonetic: null, bbox: { x0: 72, y0: 0, x1: 80, y1: 10 }, confidence: 90, confirmed: false },
    { id: "9", text: "toothpaste", rawText: "toothpaste", phonetic: null, bbox: { x0: 82, y0: 0, x1: 90, y1: 10 }, confidence: 90, confirmed: false },
    { id: "10", text: "on", rawText: "on", phonetic: null, bbox: { x0: 92, y0: 0, x1: 100, y1: 10 }, confidence: 90, confirmed: false },
    { id: "11", text: "my", rawText: "my", phonetic: null, bbox: { x0: 102, y0: 0, x1: 110, y1: 10 }, confidence: 90, confirmed: false },
    { id: "12", text: "brush", rawText: "brush.", phonetic: null, bbox: { x0: 112, y0: 0, x1: 120, y1: 10 }, confidence: 90, confirmed: false },
  ];

  const sentence = assembledSentence(words, "single", 200);
  assert.equal(sentence, "I brush my teeth every morning. I put toothpaste on my brush.");

  const plan = buildSpeechPlan(words, "single", 200, null);
  assert.equal(plan.spoken, "I brush my teeth every morning. I put toothpaste on my brush.");
  assert.equal(plan.tokens[5].display, "morning");
  assert.equal(plan.tokens[5].speak, "morning.");
});
