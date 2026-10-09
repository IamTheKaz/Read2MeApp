# Read2Me (Page Aloud)

An AI-assisted classroom reader: photograph a book page (or drop in a whole PDF), review every word, then let students listen and play a find-the-word game on the real page.

**Live demo:** [read2-me-wheat.vercel.app](https://read2-me-wheat.vercel.app)

**This repository:** [github.com/IamTheKaz/Read2MeApp](https://github.com/IamTheKaz/Read2MeApp)

The product name in the UI is **Page Aloud**.

Built with **Grok Build**, Claude, and VS Code as an agentic coding experiment — a production-shaped web app, not a prompt dump.

---

## What it does

Teachers turn photographed pages into a guided reading session. Students type a name (no password), listen to the page, then find a short list of words on the picture.

| Role | Flow |
| --- | --- |
| **Teacher** | Shared password → create a book → upload a page photo **or a whole PDF** → OCR detects words → review spelling, pronunciation, and reading order → choose focus words (or leave them random) → preview TTS → approve |
| **Student** | Type a name → pick an approved book → **listen once** (karaoke highlight) → find the target words on the page → “Good job” → next page |

---

## Features

**Teacher studio** (`/teacher`)

- Password gate. The studio stays locked until the shared teacher password is entered.
- Book library: create, rename, and reopen drafts.
- Page pipeline: **Upload → Detect → Review → Preview → Approve**.
- Single page photo, or a **whole PDF** (up to 20 pages). Each PDF page is turned into an image in the browser and added to the book.
- Tesseract.js OCR (English) with word boxes drawn on the photo.
- Per-word spelling and pronunciation overrides, plus a reading-order editor for the whole sentence.
- Add a word OCR missed by placing a box on the page.
- **Find-the-word list**, per page:
  - **Random 3–5** unique words (the default), or
  - words the teacher taps on the page, or
  - a photo of a focus-word list, read with OCR and matched to words that actually appear on the page. Spellings that are not on the page are skipped, not treated as an error.
- Student scores: expand a student and book into a per-page, per-word breakdown (time to find the word, wrong tries).
- Destructive admin actions, each behind “Are you sure?” and a password re-check:
  - clear all word-find scores
  - delete all books
  - reset the teacher password

**Student reading** (`/read`)

- Name only — no account.
- Approved pages only.
- Narration is preloaded before karaoke highlighting starts, so a slow connection does not drift the highlight off the audio.
- Listening does not finish the page. After “Read to me” plays through once, the find-the-word game unlocks.
- Every word on the page is tappable and speaks itself. The current target is prompted as “Find the word …”.
- **Next** stays locked until every target on that page is found. Going **Back** does not keep the page marked done.
- A modal “Good job!” after each page. On the last page the same modal is “You finished the book!” with **Back to library**.

---

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TanStack Router / Start, Tailwind CSS v4, Radix |
| Data | PGLite (Postgres in the browser process) via server functions. Books, pages, and word finds are stored there — not only in `localStorage`. |
| OCR | [tesseract.js](https://tesseract.projectnaptha.com/) (English), including focus-word photos |
| PDF | [pdf.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`), rasterized to JPEG page images |
| Speech | Web Speech API (`speechSynthesis`) with word-boundary karaoke |
| Language | TypeScript |

There is no student login. Teacher actions that change or delete data re-check the shared password on the server.

---

## App map

```
src/
├── routes/
│   ├── index.tsx          # role picker (Teacher / Student)
│   ├── teacher.tsx        # teacher studio
│   └── read.tsx           # student reader
├── components/
│   ├── teacher-app.tsx    # studio shell
│   ├── teacher-gate.tsx   # shared password
│   ├── teacher-admin.tsx  # clear scores, delete books, reset password
│   ├── library-view.tsx   # books + PDF import
│   ├── book-view.tsx
│   ├── upload-panel.tsx   # page photo or PDF
│   ├── page-canvas.tsx    # photo + word boxes
│   ├── review-sidebar.tsx # spelling, order, focus words
│   ├── word-popover.tsx
│   ├── scores-view.tsx
│   └── student-app.tsx    # listen, then find-the-word
├── lib/
│   ├── ocr.ts
│   ├── pdf-pages.ts       # PDF → page images (max 20)
│   ├── tts.ts
│   ├── word-find.ts       # random targets or teacher focus list
│   ├── page-model.ts
│   └── book-model.ts
├── server/                # POST server functions (books, scores, teacher)
└── store/
```

---

## Run locally

Requires Node 22+.

```bash
npm install
npm run dev
```

The dev server listens on port **8080**.

```bash
npm run typecheck
npm test
npm run build
```

The teacher password lives in app data (see `src/lib/password.server.ts` and `src/server/teacher.ts`). Students never need it. The first time the studio is opened with no password set, the gate asks you to create one.

---

## Design notes

- **Human in the loop.** OCR is a draft. Nothing is student-facing until a teacher approves the page.
- **The original page stays visible.** Karaoke and the game happen on the photo, not a re-typeset page.
- **Three different teacher edits.** Spelling, pronunciation (a phonetic respelling that does not change the printed word), and sentence order are separate controls.
- **Listen, then find.** Narration is a listening aid. Page progress is the word game, not “the audio finished.”
- **Focus words are optional.** If the teacher does not set any, the student gets 3–5 random words from that page.

---

## Related

- [AOBook2](https://github.com/IamTheKaz/AOBook2) — novel companion site and karaoke chapter reader, built with the same agentic loop.
- [Read2Me](https://github.com/IamTheKaz/Read2Me) — earlier prototype. This repo (`Read2MeApp`) is the current app.

---

## Author

**Kassandra (Kaz) Wolff** — [@IamTheKaz](https://github.com/IamTheKaz)

Built with Grok Build, Claude, and VS Code.
