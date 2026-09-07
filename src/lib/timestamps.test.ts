import { strict as assert } from "node:assert";
import { test } from "node:test";
import { compareTimestamps, toIsoTimestamp } from "./timestamps.ts";

test("toIsoTimestamp accepts Date, ISO string, and epoch ms", () => {
  const iso = "2026-09-07T16:21:14.000Z";
  assert.equal(toIsoTimestamp(new Date(iso)), iso);
  assert.equal(toIsoTimestamp(iso), iso);
  assert.equal(toIsoTimestamp(Date.parse(iso)), iso);
});

test("compareTimestamps does not call localeCompare on Date objects", () => {
  const earlier = new Date("2026-01-01T00:00:00.000Z");
  const later = new Date("2026-02-01T00:00:00.000Z");
  assert.ok(compareTimestamps(earlier, later) < 0);
  assert.ok(compareTimestamps(later, earlier) > 0);
  assert.equal(compareTimestamps(earlier, earlier.toISOString()), 0);
});
