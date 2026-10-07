import { create } from "zustand";
import { assembledSentence, buildSpeechPlan, normalizeToken, type PageImage, type PageLayout, type PageWord } from "@/lib/page-model";
import { detectWords, fileToDataUrl, samplePageDataUrl } from "@/lib/ocr";
import { pdfFileToImages } from "@/lib/pdf-pages";
import { canSpeak, cancelSpeech, speakText } from "@/lib/tts";
import { uniqueWordTexts } from "@/lib/word-find";
import { useBookStore } from "@/store/book-store";

export type EditorMode = "spelling" | "pronunciation";
export type OcrState = {
  status: "idle" | "running" | "done" | "error";
  progress: number;
  message: string;
};
export type PlaybackState = {
  kind: "idle" | "word" | "sentence";
  wordId: string | null;
};
export type ImportJob = {
  status: "idle" | "running" | "error";
  message: string;
  progress: number;
};

type PageStore = {
  image: PageImage | null;
  words: PageWord[];
  layout: PageLayout;
  sentenceOverride: string | null;
  /** Book this page belongs to; null in standalone (pre-book) sessions. */
  bookId: string | null;
  /** Id of the page inside the book; null until the first upload for it. */
  pageId: string | null;
  selectedId: string | null;
  editorMode: EditorMode;
  showOrderEditor: boolean;
  orderDraft: string;
  placingWord: boolean;
  pickingFocus: boolean;
  focusTexts: string[];
  ocr: OcrState;
  playback: PlaybackState;
  importJob: ImportJob;
  hasPreviewed: boolean;
  approved: boolean;
  approvedAt: string | null;
  ttsAvailable: boolean;
  loadFile: (file: File) => Promise<void>;
  loadSample: () => Promise<void>;
  importPdf: (file: File) => Promise<void>;
  loadFocusImage: (file: File) => Promise<{ matched: number; total: number }>;
  setFocusTexts: (texts: string[]) => void;
  toggleFocusText: (text: string) => void;
  setPickingFocus: (on: boolean) => void;
  reset: () => void;
  /** Start a fresh, empty page inside a book (shows the upload panel). */
  beginBookPage: (bookId: string) => void;
  /** Load an existing book page back into the editor. */
  openBookPage: (bookId: string, pageId: string) => void;
  setLayout: (layout: PageLayout) => void;
  selectWord: (id: string | null, play?: boolean) => void;
  setEditorMode: (mode: EditorMode) => void;
  updateSpelling: (id: string, text: string) => void;
  confirmWord: (id: string) => void;
  confirmRemaining: () => void;
  setPhonetic: (id: string, phonetic: string | null) => void;
  addWordAt: (point: { x: number; y: number }) => void;
  removeWord: (id: string) => void;
  setPlacingWord: (on: boolean) => void;
  playWord: (id: string) => void;
  previewSentence: () => void;
  stopPlayback: () => void;
  setShowOrderEditor: (open: boolean) => void;
  setOrderDraft: (value: string) => void;
  applyReadingOrder: () => void;
  clearReadingOrder: () => void;
  approve: () => void;
};

const idleOcr: OcrState = { status: "idle", progress: 0, message: "" };
const idleImport: ImportJob = { status: "idle", message: "", progress: 0 };

/** Give the upcoming upload a page id so it syncs into the active book. */
function mintPageIdForBook(
  get: () => PageStore,
  set: (partial: Partial<PageStore>) => void,
) {
  if (get().bookId && !get().pageId) {
    set({ pageId: crypto.randomUUID() });
  }
}

function touchAfterEdit(set: (partial: Partial<PageStore>) => void) {
  set({ approved: false, approvedAt: null });
}

async function runOcr(src: string, name: string, set: (partial: Partial<PageStore>) => void) {
  cancelSpeech();
  set({
    image: { name, src, width: 0, height: 0 },
    words: [],
    sentenceOverride: null,
    selectedId: null,
    editorMode: "spelling",
    showOrderEditor: false,
    orderDraft: "",
    placingWord: false,
    pickingFocus: false,
    focusTexts: [],
    ocr: { status: "running", progress: 0.02, message: "Opening the page image" },
    playback: { kind: "idle", wordId: null },
    hasPreviewed: false,
    approved: false,
    approvedAt: null,
    ttsAvailable: canSpeak(),
  });
  try {
    const result = await detectWords(src, (info) => {
      set({
        ocr: {
          status: "running",
          progress: Math.max(0.04, Math.min(0.98, info.progress || 0.04)),
          message: info.status,
        },
      });
    });
    set({
      image: { name, src, width: result.width, height: result.height },
      words: result.words,
      ocr: {
        status: "done",
        progress: 1,
        message:
          result.words.length === 0
            ? "No words found — try a clearer photo"
            : `Found ${result.words.length} word${result.words.length === 1 ? "" : "s"}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read this page.";
    set({
      ocr: { status: "error", progress: 0, message },
    });
  }
}

export const usePageStore = create<PageStore>((set, get) => ({
  image: null,
  words: [],
  layout: "single",
  sentenceOverride: null,
  bookId: null,
  pageId: null,
  selectedId: null,
  editorMode: "spelling",
  showOrderEditor: false,
  orderDraft: "",
  placingWord: false,
  pickingFocus: false,
  focusTexts: [],
  ocr: idleOcr,
  playback: { kind: "idle", wordId: null },
  importJob: idleImport,
  hasPreviewed: false,
  approved: false,
  approvedAt: null,
  ttsAvailable: true,

  loadFile: async (file) => {
    mintPageIdForBook(get, set);
    const src = await fileToDataUrl(file);
    await runOcr(src, file.name || "page.png", set);
  },

  loadSample: async () => {
    mintPageIdForBook(get, set);
    const sample = await samplePageDataUrl();
    await runOcr(sample.src, sample.name, set);
  },

  importPdf: async (file) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error("Open a book first.");
    cancelSpeech();
    set({
      importJob: { status: "running", message: "Opening PDF", progress: 0.04 },
      placingWord: false,
      pickingFocus: false,
    });
    try {
      const { pages, truncated, totalInFile } = await pdfFileToImages(file, ({ page, total }) => {
        set({
          importJob: {
            status: "running",
            message: `Reading PDF page ${page} of ${total}`,
            progress: 0.05 + 0.2 * (page / Math.max(total, 1)),
          },
        });
      });
      if (pages.length === 0) throw new Error("That PDF has no pages.");
      const created: string[] = [];
      for (let i = 0; i < pages.length; i += 1) {
        const img = pages[i]!;
        set({
          importJob: {
            status: "running",
            message: `Finding words on page ${i + 1} of ${pages.length}`,
            progress: 0.28 + 0.7 * (i / pages.length),
          },
        });
        const result = await detectWords(img.src);
        const pageId = crypto.randomUUID();
        created.push(pageId);
        useBookStore.getState().upsertPage(bookId, {
          id: pageId,
          createdAt: new Date().toISOString(),
          image: { name: img.name, src: img.src, width: result.width, height: result.height },
          words: result.words,
          layout: "single",
          sentenceOverride: null,
          hasPreviewed: false,
          approved: false,
          approvedAt: null,
          focusTexts: [],
        });
      }
      const note = truncated
        ? `Imported the first ${pages.length} of ${totalInFile} pages.`
        : `Imported ${pages.length} page${pages.length === 1 ? "" : "s"}.`;
      set({ importJob: { status: "idle", message: note, progress: 1 } });
      const first = created[0];
      if (first) get().openBookPage(bookId, first);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not import that PDF.";
      set({ importJob: { status: "error", message, progress: 0 } });
    }
  },

  loadFocusImage: async (file) => {
    const src = await fileToDataUrl(file);
    const result = await detectWords(src);
    const texts = uniqueWordTexts(result.words.map((w) => w.text));
    const pageKeys = new Set(get().words.map((w) => normalizeToken(w.text)).filter(Boolean));
    const matched = texts.filter((t) => pageKeys.has(normalizeToken(t))).length;
    set({
      focusTexts: texts,
      pickingFocus: true,
      placingWord: false,
      selectedId: null,
      approved: false,
      approvedAt: null,
    });
    return { matched, total: texts.length };
  },

  setFocusTexts: (texts) => {
    set({
      focusTexts: uniqueWordTexts(texts),
      approved: false,
      approvedAt: null,
    });
  },

  toggleFocusText: (text) => {
    const key = normalizeToken(text);
    if (!key) return;
    const current = get().focusTexts;
    const exists = current.some((t) => normalizeToken(t) === key);
    const next = exists
      ? current.filter((t) => normalizeToken(t) !== key)
      : uniqueWordTexts([...current, text]);
    set({
      focusTexts: next,
      approved: false,
      approvedAt: null,
    });
  },

  setPickingFocus: (on) => {
    set({
      pickingFocus: on,
      placingWord: on ? false : get().placingWord,
      selectedId: on ? null : get().selectedId,
      showOrderEditor: on ? false : get().showOrderEditor,
    });
  },

  reset: () => {
    cancelSpeech();
    set({
      image: null,
      words: [],
      layout: "single",
      sentenceOverride: null,
      bookId: null,
      pageId: null,
      selectedId: null,
      editorMode: "spelling",
      showOrderEditor: false,
      orderDraft: "",
      placingWord: false,
      pickingFocus: false,
      focusTexts: [],
      ocr: idleOcr,
      playback: { kind: "idle", wordId: null },
      importJob: idleImport,
      hasPreviewed: false,
      approved: false,
      approvedAt: null,
    });
  },

  beginBookPage: (bookId) => {
    cancelSpeech();
    set({
      image: null,
      words: [],
      layout: "single",
      sentenceOverride: null,
      bookId,
      pageId: null,
      selectedId: null,
      editorMode: "spelling",
      showOrderEditor: false,
      orderDraft: "",
      placingWord: false,
      pickingFocus: false,
      focusTexts: [],
      ocr: idleOcr,
      playback: { kind: "idle", wordId: null },
      importJob: idleImport,
      hasPreviewed: false,
      approved: false,
      approvedAt: null,
    });
  },

  openBookPage: (bookId, pageId) => {
    const book = useBookStore.getState().books.find((b) => b.id === bookId);
    const page = book?.pages.find((p) => p.id === pageId);
    if (!page) return;
    cancelSpeech();
    set({
      image: page.image,
      words: page.words,
      layout: page.layout,
      sentenceOverride: page.sentenceOverride,
      bookId,
      pageId,
      selectedId: null,
      editorMode: "spelling",
      showOrderEditor: false,
      orderDraft: "",
      placingWord: false,
      pickingFocus: false,
      focusTexts: page.focusTexts ?? [],
      ocr: {
        status: "done",
        progress: 1,
        message:
          page.words.length === 0
            ? "No words found — try a clearer photo"
            : `Found ${page.words.length} word${page.words.length === 1 ? "" : "s"}`,
      },
      playback: { kind: "idle", wordId: null },
      hasPreviewed: page.hasPreviewed,
      approved: page.approved,
      approvedAt: page.approvedAt,
      ttsAvailable: canSpeak(),
    });
  },

  setLayout: (layout) => {
    const { sentenceOverride, words, image } = get();
    touchAfterEdit(set);
    set({
      layout,
      hasPreviewed: false,
      orderDraft:
        sentenceOverride ??
        (image ? assembledSentence(words, layout, image.width) : ""),
    });
  },

  selectWord: (id, play = true) => {
    if (get().pickingFocus) {
      if (!id) {
        set({ selectedId: null });
        return;
      }
      const word = get().words.find((w) => w.id === id);
      if (word?.text.trim()) get().toggleFocusText(word.text);
      return;
    }
    if (!id) {
      set({ selectedId: null });
      return;
    }
    set({ selectedId: id, editorMode: "spelling", showOrderEditor: false, placingWord: false });
    if (play) get().playWord(id);
  },

  setEditorMode: (mode) => set({ editorMode: mode }),

  updateSpelling: (id, text) => {
    set({
      words: get().words.map((w) => (w.id === id ? { ...w, text } : w)),
      approved: false,
      approvedAt: null,
    });
  },

  confirmWord: (id) => {
    const words = get().words.map((w) =>
      w.id === id ? { ...w, text: w.text.trim() || w.text, confirmed: true } : w,
    );
    set({ words, approved: false, approvedAt: null });
  },

  confirmRemaining: () => {
    set({
      words: get().words.map((w) => ({ ...w, confirmed: true })),
      approved: false,
      approvedAt: null,
    });
  },

  setPhonetic: (id, phonetic) => {
    const next = phonetic?.trim() ? phonetic.trim() : null;
    set({
      words: get().words.map((w) => (w.id === id ? { ...w, phonetic: next } : w)),
      approved: false,
      approvedAt: null,
    });
  },

  setPlacingWord: (on) => {
    set({
      placingWord: on,
      pickingFocus: on ? false : get().pickingFocus,
      selectedId: on ? null : get().selectedId,
    });
  },

  addWordAt: (point) => {
    const { image, words } = get();
    if (!image || image.width <= 0 || image.height <= 0) return;
    const heights = words.map((w) => Math.max(12, w.bbox.y1 - w.bbox.y0)).sort((a, b) => a - b);
    const boxH = heights[Math.floor(heights.length / 2)] ?? Math.max(28, image.height * 0.04);
    const boxW = Math.max(boxH * 2.4, image.width * 0.08);
    const x0 = Math.max(0, Math.min(image.width - 8, point.x - boxW / 2));
    const y0 = Math.max(0, Math.min(image.height - 8, point.y - boxH / 2));
    const word = {
      id: crypto.randomUUID(),
      text: "",
      phonetic: null,
      bbox: {
        x0,
        y0,
        x1: Math.min(image.width, x0 + boxW),
        y1: Math.min(image.height, y0 + boxH),
      },
      confidence: 100,
      confirmed: false,
    };
    set({
      words: [...words, word],
      selectedId: word.id,
      editorMode: "spelling",
      placingWord: false,
      showOrderEditor: false,
      approved: false,
      approvedAt: null,
      hasPreviewed: false,
    });
  },

  removeWord: (id) => {
    const { words, selectedId } = get();
    set({
      words: words.filter((w) => w.id !== id),
      selectedId: selectedId === id ? null : selectedId,
      approved: false,
      approvedAt: null,
      hasPreviewed: false,
    });
  },

  playWord: (id) => {
    const word = get().words.find((w) => w.id === id);
    if (!word) return;
    const text = word.phonetic?.trim() || word.text;
    set({ playback: { kind: "word", wordId: id } });
    const handle = speakText(text, { rate: 0.5 });
    void handle.done.then(() => {
      const current = get().playback;
      if (current.kind === "word" && current.wordId === id) {
        set({ playback: { kind: "idle", wordId: null } });
      }
    });
  },

  previewSentence: () => {
    const { words, layout, image, sentenceOverride } = get();
    if (!image || words.length === 0) return;
    const plan = buildSpeechPlan(words, layout, image.width, sentenceOverride);
    if (!plan.spoken) return;
    set({
      selectedId: null,
      showOrderEditor: false,
      playback: { kind: "sentence", wordId: plan.tokens[0]?.wordId ?? null },
      hasPreviewed: true,
    });
    const handle = speakText(plan.spoken, {
      rate: 0.5,
      tokens: plan.tokens,
      onToken: (token) => {
        const current = get().playback;
        if (current.kind !== "sentence") return;
        set({ playback: { kind: "sentence", wordId: token.wordId } });
      },
    });
    void handle.done.then(() => {
      if (get().playback.kind === "sentence") {
        set({ playback: { kind: "idle", wordId: null } });
      }
    });
  },

  stopPlayback: () => {
    cancelSpeech();
    set({ playback: { kind: "idle", wordId: null } });
  },

  setShowOrderEditor: (open) => {
    const { words, layout, image, sentenceOverride } = get();
    if (open) {
      get().stopPlayback();
      set({
        showOrderEditor: true,
        selectedId: null,
        orderDraft:
          sentenceOverride ??
          (image ? assembledSentence(words, layout, image.width) : ""),
      });
    } else {
      set({ showOrderEditor: false });
    }
  },

  setOrderDraft: (value) => set({ orderDraft: value }),

  applyReadingOrder: () => {
    const draft = get().orderDraft.trim();
    set({
      sentenceOverride: draft || null,
      showOrderEditor: false,
      approved: false,
      approvedAt: null,
      hasPreviewed: false,
    });
    if (draft) {
      // Auto-regenerate the full-sentence preview with the new order.
      queueMicrotask(() => get().previewSentence());
    }
  },

  clearReadingOrder: () => {
    const { words, layout, image } = get();
    set({
      sentenceOverride: null,
      orderDraft: image ? assembledSentence(words, layout, image.width) : "",
      approved: false,
      approvedAt: null,
      hasPreviewed: false,
    });
  },

  approve: () => {
    const { image, words, hasPreviewed } = get();
    if (!image || words.length === 0 || !hasPreviewed) return;
    get().stopPlayback();
    set({
      approved: true,
      approvedAt: new Date().toISOString(),
      selectedId: null,
      showOrderEditor: false,
    });
  },
}));

/**
 * Keep the active book's copy of the page in sync with the editor. Any change
 * to the persisted fields (image, words, layout, sentence, preview, approval)
 * upserts a snapshot into the book store, which persists it to localStorage.
 * Books stay usable in any partial state — no save step, no completion gate.
 */
usePageStore.subscribe((state, prev) => {
  const { bookId, pageId } = state;
  if (!bookId || !pageId || !state.image) return;
  if (
    state.image === prev.image &&
    state.words === prev.words &&
    state.layout === prev.layout &&
    state.sentenceOverride === prev.sentenceOverride &&
    state.hasPreviewed === prev.hasPreviewed &&
    state.approved === prev.approved &&
    state.approvedAt === prev.approvedAt &&
    state.focusTexts === prev.focusTexts
  ) {
    return;
  }
  const books = useBookStore.getState();
  if (!books.books.some((b) => b.id === bookId)) return;
  books.upsertPage(bookId, {
    id: pageId,
    createdAt: new Date().toISOString(),
    image: state.image,
    words: state.words,
    layout: state.layout,
    sentenceOverride: state.sentenceOverride,
    hasPreviewed: state.hasPreviewed,
    approved: state.approved,
    approvedAt: state.approvedAt,
    focusTexts: state.focusTexts,
  });
});
