"use client";
import { useMemo } from "react";
import { useScope } from "@/components/scope-context";
import { useCurrency } from "@/components/currency-context";
import { filterPortfolio } from "@/lib/scope";
import { computeNetWorth } from "@/lib/networth";
import { toBase } from "@/lib/fx";
import { annualize } from "@/lib/labels";
import { buildInsightsInput } from "@/lib/insights-input";
import { computeInsights } from "@/lib/insights";
import { PageHeader } from "@/components/ui-bits";
import { InsightsFeed } from "@/components/insights-feed";
import type { Portfolio } from "@/lib/load";
import type { Expense, Goal, IncomeSource, Owner, Valuation } from "@/lib/types";

export function InsightsView({
  owners,
  portfolio,
  valuations,
  incomeSources,
  expenses,
  goals,
}: {
  owners: Owner[];
  portfolio: Portfolio;
  valuations: Valuation[];
  incomeSources: IncomeSource[];
  expenses: Expense[];
  goals: Goal[];
}) {
  const { ownerIds, includesOwner } = useScope();
  const { reportingCurrency, rates } = useCurrency();

  const insights = useMemo(() => {
    const scoped = filterPortfolio(portfolio, ownerIds);
    const nw = computeNetWorth({
      reportingCurrency,
      rates,
      owners,
      accounts: scoped.accounts,
      holdings: scoped.holdings,
      assets: scoped.assets,
      liabilities: scoped.liabilities,
      ownership: scoped.ownership,
    });
    const annualIncomeMinor = incomeSources
      .filter((s) => s.is_active && includesOwner(s.owner_id))
      .reduce((sum, s) => sum + toBase(annualize(s.expected_amount_minor, s.cadence), s.currency, reportingCurrency, rates), 0);
    const annualExpensesMinor = expenses
      .filter((e) => includesOwner(e.owner_id))
      .reduce((sum, e) => {
        const amt = e.is_recurring && e.cadence ? annualize(e.amount_minor, e.cadence) : e.amount_minor;
        return sum + toBase(amt, e.currency, reportingCurrency, rates);
      }, 0);
    const scopedGoals = goals.filter((g) => g.owner_id == null || includesOwner(g.owner_id));

    return computeInsights(
      buildInsightsInput({
        nw,
        goals: scopedGoals,
        liabilities: scoped.liabilities,
        owners,
        valuations,
        annualIncomeMinor,
        annualExpensesMinor,
        reportingCurrency,
        rates,
      }),
    );
  }, [portfolio, ownerIds, includesOwner, owners, valuations, incomeSources, expenses, goals, reportingCurrency, rates]);

  return (
    <div>
      <PageHeader
        title="Insights"
        description="Tailored observations from your finances. Informational only - not financial advice."
      />
      <InsightsFeed insights={insights} />
    </div>
  );
}
