/**
 * Helpers for the "YYYY-MM-DDTHH:mm" strings used by <input type="datetime-local">.
 *
 * We parse the parts manually instead of `new Date(string)` so the value is always
 * interpreted in the user's LOCAL time zone and malformed strings are rejected.
 */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseLocalDateTime(value: string): Date | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) {
    return null;
  }
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s || 0, 0);

  // Reject impossible values such as 2026-02-31 (Date would silently roll them over).
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || date.getHours() !== h) {
    return null;
  }
  return date;
}

/** Formats a Date as a datetime-local value (minute precision). */
export function toLocalDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** True only if the value is a valid date-time strictly later than `now`. */
export function isStrictlyFuture(value: string, now: Date): boolean {
  const date = parseLocalDateTime(value);
  return date !== null && date.getTime() > now.getTime();
}
