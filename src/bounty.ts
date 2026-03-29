/** YYYY-MM-DD in the given IANA time zone. */
export function calendarDateKeyInTimeZone(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

export function timeHourMinuteInTimeZone(
  epochMs: number,
  timeZone: string
): { hour: number; minute: number; dateKey: string } {
  const d = new Date(epochMs);
  const dateKey = calendarDateKeyInTimeZone(epochMs, timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { hour, minute, dateKey };
}

export function formatBountyDateLabel(dateKey: string, timeZone: string): string {
  const [y, m, day] = dateKey.split("-").map(Number);
  if (!y || !m || !day) return dateKey;
  const utcNoon = Date.UTC(y, m - 1, day, 12, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(utcNoon));
}
