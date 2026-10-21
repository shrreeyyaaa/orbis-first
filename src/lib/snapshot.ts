import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio, loadValuations } from "@/lib/load";
import { computeNetWorth } from "@/lib/networth";
import { buildRateMap } from "@/lib/fx";
import { computeHealthScore } from "@/lib/health-score";
import { buildInsightsInput } from "@/lib/insights-input";
import { computeInsights } from "@/lib/insights";
import { getMinorDigits } from "@/lib/currency";
import { annualize } from "@/lib/labels";
import { toBase } from "@/lib/fx";
import type { Expense, ExchangeRate, Goal, IncomeSource } from "@/lib/types";

export interface FinancialSnapshot {
  householdName: string;
  reportingCurrency: string;
  asOf: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  allocation: { group: string; value: number; pct: number }[];
  byOwner: { owner: string; net: number }[];
  topHoldings: { name: string; value: number; group: string }[];
  annualIncome: number;
  annualExpenses: number;
  monthlyNetCashFlow: number;
  savingsRatePct: number | null;
  goals: { name: string; saved: number; target: number; pct: number }[];
  healthScore: number;
  healthTier: string;
  insights: { severity: string; title: string; detail: string }[];
}

/** Builds a compact financial snapshot for the signed-in household, or null. */
export async function buildSnapshot(): Promise<FinancialSnapshot | null> {
  const ctx = await getHouseholdContext();
  if (!ctx) return null;
  const hid = ctx.household.id;
  const supabase = await createClient();

  const [portfolio, valuations, incomeRes, expenseRes, goalRes, rateRes] = await Promise.all([
    loadPortfolio(hid),
    loadValuations(hid),
    supabase.from("income_sources").select("*").eq("household_id", hid),
    supabase.from("expenses").select("*").eq("household_id", hid),
    supabase.from("goals").select("*").eq("household_id", hid),
    supabase.from("exchange_rates").select("*").eq("household_id", hid),
  ]);

  const reportingCurrency = ctx.household.reporting_currency;
  const rates = buildRateMap((rateRes.data ?? []) as ExchangeRate[]);
  const digits = getMinorDigits(reportingCurrency);
  const major = (minor: number) => Math.round((minor / 10 ** digits) * 100) / 100;

  const incomeSources = (incomeRes.data ?? []) as IncomeSource[];
  const expenses = (expenseRes.data ?? []) as Expense[];
  const goals = (goalRes.data ?? []) as Goal[];

  const nw = computeNetWorth({
    reportingCurrency,
    rates,
    owners: ctx.owners,
    accounts: portfolio.accounts,
    holdings: portfolio.holdings,
    assets: portfolio.assets,
    liabilities: portfolio.liabilities,
    ownership: portfolio.ownership,
  });

  const annualIncomeMinor = incomeSources
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + toBase(annualize(s.expected_amount_minor, s.cadence), s.currency, reportingCurrency, rates), 0);
  const annualExpensesMinor = expenses.reduce((sum, e) => {
    const amt = e.is_recurring && e.cadence ? annualize(e.amount_minor, e.cadence) : e.amount_minor;
    return sum + toBase(amt, e.currency, reportingCurrency, rates);
  }, 0);

  const liquidMinor = nw.byGroup.find((g) => g.group === "Cash & Equivalents")?.valueMinor ?? 0;
  const goalsWithTarget = goals.filter((g) => g.target_minor > 0);
  const goalFundingAvg =
    goalsWithTarget.length === 0
      ? null
      : goalsWithTarget.reduce((s, g) => s + Math.min(1, g.manual_saved_minor / g.target_minor), 0) /
        goalsWithTarget.length;
  const latest = valuations.length
    ? valuations.reduce((m, v) => (v.as_of_date > m ? v.as_of_date : m), valuations[0].as_of_date)
    : null;
  const daysSinceUpdate = latest ? Math.round((Date.now() - new Date(latest).getTime()) / 86400000) : null;

  const health = computeHealthScore({
    netWorthMinor: nw.netWorthMinor,
    totalAssetsMinor: nw.totalAssetsMinor,
    totalLiabilitiesMinor: nw.totalLiabilitiesMinor,
    liquidMinor,
    annualIncomeMinor,
    annualExpensesMinor,
    assetGroupCount: nw.byGroup.length,
    goalFundingAvg,
    daysSinceUpdate,
  });

  const insights = computeInsights(
    buildInsightsInput({
      nw,
      goals,
      liabilities: portfolio.liabilities,
      owners: ctx.owners,
      valuations,
      annualIncomeMinor,
      annualExpensesMinor,
      reportingCurrency,
      rates,
    }),
  );

  const savingsRatePct =
    annualIncomeMinor > 0
      ? Math.round(((annualIncomeMinor - annualExpensesMinor) / annualIncomeMinor) * 100)
      : null;

  return {
    householdName: ctx.household.name,
    reportingCurrency,
    asOf: new Date().toISOString().slice(0, 10),
    netWorth: major(nw.netWorthMinor),
    totalAssets: major(nw.totalAssetsMinor),
    totalLiabilities: major(nw.totalLiabilitiesMinor),
    allocation: nw.byGroup.map((g) => ({
      group: g.group,
      value: major(g.valueMinor),
      pct: nw.totalAssetsMinor > 0 ? Math.round((g.valueMinor / nw.totalAssetsMinor) * 100) : 0,
    })),
    byOwner: nw.byOwner.map((o) => ({ owner: o.ownerName, net: major(o.netMinor) })),
    topHoldings: [...nw.items]
      .filter((i) => i.baseMinor > 0)
      .sort((a, b) => b.baseMinor - a.baseMinor)
      .slice(0, 5)
      .map((i) => ({ name: i.name, value: major(i.baseMinor), group: i.group })),
    annualIncome: major(annualIncomeMinor),
    annualExpenses: major(annualExpensesMinor),
    monthlyNetCashFlow: major(Math.round((annualIncomeMinor - annualExpensesMinor) / 12)),
    savingsRatePct,
    goals: goalsWithTarget.map((g) => ({
      name: g.name,
      saved: major(toBase(g.manual_saved_minor, g.currency, reportingCurrency, rates)),
      target: major(toBase(g.target_minor, g.currency, reportingCurrency, rates)),
      pct: Math.min(100, Math.round((g.manual_saved_minor / g.target_minor) * 100)),
    })),
    healthScore: health.score,
    healthTier: health.tier,
    insights: insights.map((i) => ({ severity: i.severity, title: i.title, detail: i.detail })),
  };
}
