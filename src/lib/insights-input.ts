import { toBase, type RateMap } from "@/lib/fx";
import { formatMoney } from "@/lib/currency";
import type { NetWorthResult } from "@/lib/networth";
import type { Goal, Liability, Owner, Valuation } from "@/lib/types";
import type { InsightsInput } from "@/lib/insights";

const LEGAL_KINDS = ["trust", "llc", "corporation", "foundation", "estate"];

/** Assemble the (reporting-currency) input for computeInsights from raw data. */
export function buildInsightsInput(p: {
  nw: NetWorthResult;
  goals: Goal[];
  liabilities: Liability[];
  owners: Owner[];
  valuations: Valuation[];
  annualIncomeMinor: number;
  annualExpensesMinor: number;
  reportingCurrency: string;
  rates: RateMap;
}): InsightsInput {
  const { nw, reportingCurrency, rates } = p;
  const liquid = nw.byGroup.find((g) => g.group === "Cash & Equivalents")?.valueMinor ?? 0;
  const latest = p.valuations.length
    ? p.valuations.reduce((m, v) => (v.as_of_date > m ? v.as_of_date : m), p.valuations[0].as_of_date)
    : null;
  const daysSinceUpdate = latest
    ? Math.round((Date.now() - new Date(latest).getTime()) / 86400000)
    : null;

  return {
    reportingCurrency,
    netWorthMinor: nw.netWorthMinor,
    totalAssetsMinor: nw.totalAssetsMinor,
    totalLiabilitiesMinor: nw.totalLiabilitiesMinor,
    liquidMinor: liquid,
    annualIncomeMinor: p.annualIncomeMinor,
    annualExpensesMinor: p.annualExpensesMinor,
    assetGroupCount: nw.byGroup.length,
    items: nw.items
      .filter((i) => i.baseMinor > 0)
      .map((i) => ({ name: i.name, baseMinor: i.baseMinor, group: i.group })),
    goals: p.goals.map((g) => ({
      name: g.name,
      type: g.type,
      savedMinor: toBase(g.manual_saved_minor, g.currency, reportingCurrency, rates),
      targetMinor: toBase(g.target_minor, g.currency, reportingCurrency, rates),
      monthlyMinor: toBase(g.monthly_contribution_minor, g.currency, reportingCurrency, rates),
      targetDate: g.target_date,
    })),
    liabilities: p.liabilities.map((l) => ({
      name: l.name,
      ratePct: l.interest_rate_pct,
      balanceMinor: toBase(l.balance_minor, l.currency, reportingCurrency, rates),
    })),
    trustsMissingBeneficiaries: p.owners
      .filter((o) => LEGAL_KINDS.includes(o.kind) && !o.beneficiaries)
      .map((o) => o.name),
    missingRates: nw.missingRates,
    daysSinceUpdate,
    fmt: (minor: number) => formatMoney(minor, reportingCurrency),
  };
}
