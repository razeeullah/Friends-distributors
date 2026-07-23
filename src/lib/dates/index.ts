export const DEFAULT_TIMEZONE = "Asia/Karachi";
export const DEFAULT_LOCALE = "en-PK";

type DateInput = Date | string | number;

function toValidDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date value");
  }

  return date;
}

export function formatKarachiDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    ...options,
    timeZone: DEFAULT_TIMEZONE,
  }).format(toValidDate(value));
}

export function formatKarachiDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  return formatKarachiDate(value, options);
}

export function toKarachiDateKey(value: DateInput): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toValidDate(value));

  const partValues = new Map(parts.map((part) => [part.type, part.value]));
  const year = partValues.get("year");
  const month = partValues.get("month");
  const day = partValues.get("day");

  if (!year || !month || !day) {
    throw new Error("Unable to format Karachi date key");
  }

  return `${year}-${month}-${day}`;
}
