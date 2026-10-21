// Currency reference data + minor-unit aware money helpers.
//
// Every monetary value is stored as an integer count of the currency's
// smallest unit ("minor units"): cents for USD, pence for GBP, paise for INR,
// whole yen for JPY (0 decimals), fils for BHD (3 decimals). The number of
// decimal places varies per currency, so all conversions go through
// `getMinorDigits` rather than assuming 2.

export interface CurrencyMeta {
  code: string;
  symbol: string;
  name: string;
  minorDigits: number;
}

// The set we seed the database with and offer in pickers. This is the
// authoritative client-side fallback; the DB `currencies` table mirrors it.
export const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", symbol: "$", name: "US Dollar", minorDigits: 2 },
  { code: "EUR", symbol: "€", name: "Euro", minorDigits: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", minorDigits: 2 },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", minorDigits: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", minorDigits: 0 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", minorDigits: 2 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", minorDigits: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", minorDigits: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", minorDigits: 2 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", minorDigits: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", minorDigits: 2 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", minorDigits: 2 },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", minorDigits: 2 },
  { code: "BHD", symbol: "BD", name: "Bahraini Dinar", minorDigits: 3 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", minorDigits: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", minorDigits: 2 },
];

const BY_CODE: Record<string, CurrencyMeta> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

export function getCurrencyMeta(code: string): CurrencyMeta {
  return BY_CODE[code] ?? { code, symbol: code, name: code, minorDigits: 2 };
}

export function getMinorDigits(code: string): number {
  return getCurrencyMeta(code).minorDigits;
}

export function getCurrencySymbol(code: string): string {
  return getCurrencyMeta(code).symbol;
}

function minorPerMajor(code: string): bigint {
  return 10n ** BigInt(getMinorDigits(code));
}

/** Parse a user-facing decimal string into integer minor units. */
export function toMinor(input: string | number, currency: string = "USD"): bigint {
  const digits = getMinorDigits(currency);
  const trimmed = String(input).trim().replace(/[,\s$€£¥₹]/g, "");
  if (trimmed === "" || trimmed === "-" || trimmed === ".") return 0n;
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, fractionRaw = ""] = unsigned.split(".");
  const fraction = (fractionRaw + "0".repeat(digits)).slice(0, digits);
  const major = BigInt(whole || "0");
  const minor = digits > 0 ? BigInt(fraction || "0") : 0n;
  const total = major * minorPerMajor(currency) + minor;
  return negative ? -total : total;
}

/** Convert integer minor units back into a plain decimal string (no symbol). */
export function fromMinor(
  minor: bigint | number | null | undefined,
  currency: string = "USD",
): string {
  if (minor === null || minor === undefined) return "0";
  const digits = getMinorDigits(currency);
  const big = typeof minor === "bigint" ? minor : BigInt(Math.round(minor));
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const per = minorPerMajor(currency);
  const major = abs / per;
  if (digits === 0) return `${negative ? "-" : ""}${major.toString()}`;
  const fraction = (abs % per).toString().padStart(digits, "0");
  return `${negative ? "-" : ""}${major.toString()}.${fraction}`;
}

/** Format minor units as a localized currency string with symbol. */
export function formatMoney(
  minor: bigint | number | null | undefined,
  currency: string = "USD",
  opts: { compact?: boolean } = {},
): string {
  const meta = getCurrencyMeta(currency);
  if (minor === null || minor === undefined) return `${meta.symbol}0`;
  const big = typeof minor === "bigint" ? minor : BigInt(Math.round(minor));
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const value = Number(abs) / 10 ** meta.minorDigits;

  if (opts.compact && value >= 10000) {
    const compact = value.toLocaleString("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    });
    return `${negative ? "-" : ""}${meta.symbol}${compact}`;
  }

  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: meta.minorDigits === 0 ? 0 : 2,
    maximumFractionDigits: meta.minorDigits,
  });
  return `${negative ? "-" : ""}${meta.symbol}${formatted}`;
}

/**
 * Convert an amount in minor units of `from` currency into minor units of
 * `to` currency, given a decimal exchange rate (1 unit `from` = `rate` units
 * `to`). Handles differing minor-unit precision between the two currencies.
 */
export function convertMinor(
  minor: bigint | number,
  from: string,
  to: string,
  rate: number,
): bigint {
  if (from === to) return typeof minor === "bigint" ? minor : BigInt(Math.round(minor));
  const fromDigits = getMinorDigits(from);
  const toDigits = getMinorDigits(to);
  const majorValue = Number(minor) / 10 ** fromDigits;
  const converted = majorValue * rate;
  return BigInt(Math.round(converted * 10 ** toDigits));
}
