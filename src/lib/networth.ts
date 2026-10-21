import { toBase, getRate, type RateMap } from "@/lib/fx";
import { ASSET_CLASS_GROUP } from "@/lib/labels";
import { getMinorDigits } from "@/lib/currency";
import type {
  Account,
  Asset,
  AssetClass,
  Holding,
  HoldableType,
  Liability,
  Owner,
  Valuation,
} from "@/lib/types";

export interface LineItem {
  id: string;
  kind: HoldableType;
  name: string;
  ownerId: string;
  assetClass: AssetClass | null;
  group: string;
  nativeCurrency: string;
  nativeMinor: number; // signed: liabilities negative
  baseMinor: number; // signed, in reporting currency
  missingRate: boolean;
}

export interface OwnershipRow {
  holdable_type: HoldableType;
  holdable_id: string;
  owner_id: string;
  percent: number;
}

export interface NetWorthResult {
  reportingCurrency: string;
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  netWorthMinor: number;
  items: LineItem[];
  byGroup: { group: string; valueMinor: number }[];
  byOwner: { ownerId: string; ownerName: string; netMinor: number }[];
  missingRates: boolean;
}

export interface NetWorthInputs {
  reportingCurrency: string;
  rates: RateMap;
  owners: Owner[];
  accounts: Account[];
  holdings: Holding[];
  assets: Asset[];
  liabilities: Liability[];
  ownership?: OwnershipRow[];
}

function holdingValueMinor(h: Holding): number {
  // quantity * unit_price (price already in minor units of holding currency)
  return Math.round(h.quantity * h.unit_price_minor);
}

export function computeNetWorth(input: NetWorthInputs): NetWorthResult {
  const { reportingCurrency: base, rates } = input;
  const ownerName = new Map(input.owners.map((o) => [o.id, o.name]));
  const items: LineItem[] = [];

  const push = (
    kind: HoldableType,
    id: string,
    name: string,
    ownerId: string,
    assetClass: AssetClass | null,
    currency: string,
    nativeMinor: number,
  ) => {
    const { value, missingRate } = {
      value: toBase(nativeMinor, currency, base, rates),
      missingRate: getRate(rates, currency, base) == null && currency !== base,
    };
    const group = assetClass
      ? ASSET_CLASS_GROUP[assetClass]
      : kind === "liability"
        ? "Liabilities"
        : "Cash & Equivalents";
    items.push({
      id,
      kind,
      name,
      ownerId,
      assetClass,
      group,
      nativeCurrency: currency,
      nativeMinor,
      baseMinor: value,
      missingRate,
    });
  };

  const accountOwner = new Map(input.accounts.map((a) => [a.id, a.owner_id]));

  for (const a of input.accounts) {
    if (a.cash_balance_minor !== 0) {
      push("account", a.id, a.name, a.owner_id, "cash", a.currency, a.cash_balance_minor);
    }
  }
  for (const h of input.holdings) {
    const ownerId = accountOwner.get(h.account_id) ?? "";
    push("holding", h.id, h.name, ownerId, h.class, h.currency, holdingValueMinor(h));
  }
  for (const a of input.assets) {
    push("asset", a.id, a.name, a.owner_id, a.class, a.currency, a.current_value_minor);
  }
  for (const l of input.liabilities) {
    push("liability", l.id, l.name, l.owner_id, null, l.currency, -l.balance_minor);
  }

  // Ownership split overrides: map holdable -> [{owner, percent}]
  const splitKey = (t: HoldableType, id: string) => `${t}:${id}`;
  const splits = new Map<string, { owner_id: string; percent: number }[]>();
  for (const o of input.ownership ?? []) {
    const k = splitKey(o.holdable_type, o.holdable_id);
    if (!splits.has(k)) splits.set(k, []);
    splits.get(k)!.push({ owner_id: o.owner_id, percent: o.percent });
  }

  let totalAssets = 0;
  let totalLiabilities = 0;
  let missing = false;
  const byGroup = new Map<string, number>();
  const byOwner = new Map<string, number>();

  for (const it of items) {
    if (it.missingRate) missing = true;
    if (it.baseMinor >= 0) totalAssets += it.baseMinor;
    else totalLiabilities += -it.baseMinor;
    byGroup.set(it.group, (byGroup.get(it.group) ?? 0) + it.baseMinor);

    const override = splits.get(splitKey(it.kind, it.id));
    if (override && override.length) {
      for (const s of override) {
        const share = Math.round((it.baseMinor * s.percent) / 100);
        byOwner.set(s.owner_id, (byOwner.get(s.owner_id) ?? 0) + share);
      }
    } else {
      byOwner.set(it.ownerId, (byOwner.get(it.ownerId) ?? 0) + it.baseMinor);
    }
  }

  return {
    reportingCurrency: base,
    totalAssetsMinor: totalAssets,
    totalLiabilitiesMinor: totalLiabilities,
    netWorthMinor: totalAssets - totalLiabilities,
    items,
    byGroup: [...byGroup.entries()]
      .filter(([, v]) => v > 0)
      .map(([group, valueMinor]) => ({ group, valueMinor }))
      .sort((a, b) => b.valueMinor - a.valueMinor),
    byOwner: [...byOwner.entries()]
      .map(([ownerId, netMinor]) => ({
        ownerId,
        ownerName: ownerName.get(ownerId) ?? "Unassigned",
        netMinor,
      }))
      .sort((a, b) => b.netMinor - a.netMinor),
    missingRates: missing,
  };
}

/**
 * Build a net-worth time series (in reporting currency) from valuation
 * snapshots. For each date we carry forward the latest known value per
 * holdable, so the line is continuous even when items update on different days.
 */
export function computeNetWorthHistory(
  valuations: Valuation[],
  base: string,
  rates: RateMap,
  points = 24,
): { date: string; netWorthMinor: number }[] {
  if (valuations.length === 0) return [];

  const sorted = [...valuations].sort((a, b) => a.as_of_date.localeCompare(b.as_of_date));
  const dates = Array.from(new Set(sorted.map((v) => v.as_of_date)));

  // latest value per holdable as of each sampled date
  const series: { date: string; netWorthMinor: number }[] = [];
  const sampleDates = sampleEvenly(dates, points);

  for (const d of sampleDates) {
    const latest = new Map<string, Valuation>();
    for (const v of sorted) {
      if (v.as_of_date > d) break;
      latest.set(`${v.holdable_type}:${v.holdable_id}`, v);
    }
    let total = 0;
    for (const v of latest.values()) {
      const sign = v.holdable_type === "liability" ? -1 : 1;
      total += sign * toBase(v.value_minor, v.currency, base, rates);
    }
    series.push({ date: d, netWorthMinor: total });
  }
  return series;
}

function sampleEvenly<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  const step = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

/** Round a base-currency minor value for charting in major units. */
export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** getMinorDigits(currency);
}
