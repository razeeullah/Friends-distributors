export const DEFAULT_CURRENCY = "PKR";
export const DEFAULT_CURRENCY_FRACTION_DIGITS = 2;

function minorUnitsPerMajor(fractionDigits: number): bigint {
  if (
    !Number.isInteger(fractionDigits) ||
    fractionDigits < 0 ||
    fractionDigits > 6
  ) {
    throw new RangeError(
      "Currency fraction digits must be an integer from 0 to 6",
    );
  }

  return 10n ** BigInt(fractionDigits);
}

export function parseMoneyToMinor(
  value: string,
  fractionDigits = DEFAULT_CURRENCY_FRACTION_DIGITS,
): bigint {
  const normalized = value.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);

  if (!match) {
    throw new TypeError("Money must be a plain decimal string");
  }

  const [, sign, whole = "", fraction = ""] = match;

  if (fraction.length > fractionDigits) {
    throw new RangeError(
      `Money cannot have more than ${fractionDigits} fractional digits`,
    );
  }

  const scale = minorUnitsPerMajor(fractionDigits);
  const absoluteMinor =
    BigInt(whole) * scale + BigInt(fraction.padEnd(fractionDigits, "0") || "0");

  return sign === "-" ? -absoluteMinor : absoluteMinor;
}

export function minorToDecimalString(
  amountMinor: bigint,
  fractionDigits = DEFAULT_CURRENCY_FRACTION_DIGITS,
): string {
  const scale = minorUnitsPerMajor(fractionDigits);
  const isNegative = amountMinor < 0n;
  const absoluteMinor = isNegative ? -amountMinor : amountMinor;
  const whole = absoluteMinor / scale;

  if (fractionDigits === 0) {
    return `${isNegative ? "-" : ""}${whole.toString()}`;
  }

  const fraction = (absoluteMinor % scale)
    .toString()
    .padStart(fractionDigits, "0");

  return `${isNegative ? "-" : ""}${whole.toString()}.${fraction}`;
}

export function formatMoney(
  amountMinor: bigint,
  options: Readonly<{
    currency?: string;
    locale?: string;
    fractionDigits?: number;
  }> = {},
): string {
  const currency = options.currency ?? DEFAULT_CURRENCY;
  const locale = options.locale ?? "en-PK";
  const fractionDigits =
    options.fractionDigits ?? DEFAULT_CURRENCY_FRACTION_DIGITS;
  const scale = minorUnitsPerMajor(fractionDigits);
  const isNegative = amountMinor < 0n;
  const absoluteMinor = isNegative ? -amountMinor : amountMinor;
  const major = absoluteMinor / scale;
  const minor = absoluteMinor % scale;
  const formattedMajor = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(major);

  if (fractionDigits === 0) {
    return `${isNegative ? "-" : ""}${currency} ${formattedMajor}`;
  }

  return `${isNegative ? "-" : ""}${currency} ${formattedMajor}.${minor.toString().padStart(fractionDigits, "0")}`;
}

export function sumMoney(amounts: readonly bigint[]): bigint {
  return amounts.reduce((total, amount) => total + amount, 0n);
}
