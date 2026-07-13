import { PayablesDomainError } from "../payables.errors";

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseCivilDate(value: string): Date {
  if (typeof value !== "string" || !CIVIL_DATE_PATTERN.test(value)) {
    throw new PayablesDomainError("Invalid civil date");
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new PayablesDomainError("Invalid civil date");
  }
  return date;
}

export function serializeCivilDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function todayInTimeZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function assertNotFutureCivilDate(
  value: string,
  timeZone: string,
  now = new Date(),
): void {
  parseCivilDate(value);
  if (value > todayInTimeZone(timeZone, now)) {
    throw new PayablesDomainError("Payment date cannot be in the future");
  }
}
