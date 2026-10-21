import { getMinorDigits } from "@/lib/currency";
import type { ExchangeRate } from "@/lib/types";

// A directed rate map: rates[from][to] = units of `to` per 1 unit `from`.
export type RateMap = Record<string, Record<string, number>>;

/**
 * Build a rate lookup from the household's stored exchange rates, keeping only
 * the most recent rate per currency pair and adding inverse directions.
 */
export function buildRateMap(rates: ExchangeRate[]): RateMap {
  const latest = new Map<string, ExchangeRate>();
  for (const r of rates) {
    const key = `${r.base_currency}->${r.quote_currency}`;
    const prev = latest.get(key);
    if (!prev || r.as_of_date > prev.as_of_date) latest.set(key, r);
  }
  const map: RateMap = {};
  const add = (from: string, to: string, rate: number) => {
    if (!map[from]) map[from] = {};
    map[from][to] = rate;
  };
  for (const r of latest.values()) {
    add(r.base_currency, r.quote_currency, r.rate);
    if (r.rate !== 0) add(r.quote_currency, r.base_currency, 1 / r.rate);
  }
  return map;
}

/** Decimal rate to convert 1 unit `from` into `to`. Returns null if unknown. */
export function getRate(map: RateMap, from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = map[from]?.[to];
  if (direct != null) return direct;
  // try triangulation via USD
  const fromUsd = map[from]?.["USD"] ?? (map["USD"]?.[from] ? 1 / map["USD"][from] : null);
  const usdTo = map["USD"]?.[to] ?? (map[to]?.["USD"] ? 1 / map[to]["USD"] : null);
  if (fromUsd != null && usdTo != null) return fromUsd * usdTo;
  return null;
}

/**
 * Convert minor units of `from` into minor units of `to`. If the rate is
 * unknown, treats it as 1:1 but flags via the returned `missingRate`.
 */
export function convert(
  minor: number,
  from: string,
  to: string,
  map: RateMap,
): { value: number; missingRate: boolean } {
  if (from === to) return { value: minor, missingRate: false };
  const rate = getRate(map, from, to);
  const fromDigits = getMinorDigits(from);
  const toDigits = getMinorDigits(to);
  const major = minor / 10 ** fromDigits;
  const converted = major * (rate ?? 1);
  return {
    value: Math.round(converted * 10 ** toDigits),
    missingRate: rate == null,
  };
}

/** Convenience: convert and return only the value (1:1 fallback). */
export function toBase(minor: number, from: string, to: string, map: RateMap): number {
  return convert(minor, from, to, map).value;
}
