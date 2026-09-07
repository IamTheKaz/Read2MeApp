import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bookStats,
  moveBookPage,
  parseBooks,
  removeBookPage,
  serializeBooks,
  upsertBookPage,
  type Book,
  type BookPage,
} from "./book-model.ts";

let seq = 0;
function makePage(overrides: Partial<BookPage> = {}): BookPage {
  seq += 1;
  return {
    id: `page-${seq}`,
    createdAt: new Date(0).toISOString(),
    image: { name: "p.png", src: "data:image/png;base64,x", width: 100, height: 100 },
    words: [],
    layout: "single",
    sentenceOverride: null,
    hasPreviewed: false,
    approved: false,
    approvedAt: null,
    ...overrides,
  };
}

function makeBook(pages: BookPage[]): Book {
  return { id: "book-1", name: "Morning Story", createdAt: new Date(0).toISOString(), pages };
}

test("bookStats counts approved vs draft pages", () => {
  const book = makeBook([
    makePage({ approved: true, approvedAt: new Date(1).toISOString() }),
    makePage(),
    makePage({ approved: true, approvedAt: new Date(2).toISOString() }),
  ]);
  assert.deepEqual(bookStats(book), { pages: 3, approved: 2, drafts: 1 });
  assert.deepEqual(bookStats(makeBook([])), { pages: 0, approved: 0, drafts: 0 });
});

test("upsertBookPage appends a new page and replaces an existing one in place", () => {
  const first = makePage();
  const second = makePage();
  let book = makeBook([first]);
  book = upsertBookPage(book, second);
  assert.deepEqual(
    book.pages.map((p) => p.id),
    [first.id, second.id],
  );

  const edited = { ...first, approved: true, approvedAt: new Date(3).toISOString() };
  book = upsertBookPage(book, edited);
  assert.equal(book.pages.length, 2);
  assert.equal(book.pages[0].approved, true);
  // Order and createdAt are preserved on replace.
  assert.equal(book.pages[0].id, first.id);
  assert.equal(book.pages[0].createdAt, first.createdAt);
});

test("moveBookPage swaps neighbours and is a no-op at the edges", () => {
  const a = makePage();
  const b = makePage();
  const c = makePage();
  const book = makeBook([a, b, c]);

  const moved = moveBookPage(book, b.id, -1);
  assert.deepEqual(
    moved.pages.map((p) => p.id),
    [b.id, a.id, c.id],
  );

  const down = moveBookPage(book, a.id, 1);
  assert.deepEqual(
    down.pages.map((p) => p.id),
    [b.id, a.id, c.id],
  );

  // Edges and unknown ids return the same book object.
  assert.equal(moveBookPage(book, a.id, -1), book);
  assert.equal(moveBookPage(book, c.id, 1), book);
  assert.equal(moveBookPage(book, "nope", 1), book);
});

test("removeBookPage drops only the target page", () => {
  const a = makePage();
  const b = makePage();
  const book = makeBook([a, b]);
  const next = removeBookPage(book, a.id);
  assert.deepEqual(
    next.pages.map((p) => p.id),
    [b.id],
  );
});

test("books round-trip through serialize/parse and reject junk", () => {
  const book = makeBook([
    makePage({ approved: true, approvedAt: new Date(4).toISOString(), sentenceOverride: "Read me." }),
    makePage(),
  ]);
  const restored = parseBooks(serializeBooks([book]));
  assert.equal(restored.length, 1);
  assert.deepEqual(restored[0], book);

  assert.deepEqual(parseBooks(null), []);
  assert.deepEqual(parseBooks("not json"), []);
  assert.deepEqual(parseBooks("{}"), []);
  assert.deepEqual(parseBooks('[{"id":1}]'), []);
  // Pages missing an image are dropped, the book survives.
  const partial = parseBooks(
    JSON.stringify([{ id: "b", name: "B", pages: [{ id: "p1" }, makePage()] }]),
  );
  assert.equal(partial.length, 1);
  assert.equal(partial[0].pages.length, 1);
});
