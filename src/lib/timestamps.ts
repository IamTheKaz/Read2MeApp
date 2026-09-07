/** Normalize DB / serialized timestamps to ISO-8601 strings for safe compares. */
export function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? trimmed : date.toISOString();
  }
  return "";
}

export function compareTimestamps(a: unknown, b: unknown): number {
  return toIsoTimestamp(a).localeCompare(toIsoTimestamp(b));
}
