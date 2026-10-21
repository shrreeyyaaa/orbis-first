"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useScope } from "@/components/scope-context";
import { useCurrency } from "@/components/currency-context";
import { filterPortfolio } from "@/lib/scope";
import { computeNetWorth, computeNetWorthHistory } from "@/lib/networth";
import { toBase } from "@/lib/fx";
import { getMinorDigits, formatMoney } from "@/lib/currency";
import { GROUP_COLORS, GOAL_TYPE_LABELS, annualize } from "@/lib/labels";
import { computeHealthScore } from "@/lib/health-score";
import { evaluateAchievements, ACHIEVEMENTS_BY_KEY } from "@/lib/achievements";
import { buildInsightsInput } from "@/lib/insights-input";
import { computeInsights } from "@/lib/insights";
import { InsightsMini } from "@/components/insights-feed";
import { StatCard } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendChart, AllocationDonut, AllocationTreemap, Sparkline } from "@/components/charts";
import { HealthScoreCard } from "@/components/health-score-ring";
import { GettingStarted, type SetupStep } from "@/components/getting-started";
import { Celebration } from "@/components/celebrate";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { NetWorthHero } from "@/components/net-worth-hero";
import type { Portfolio } from "@/lib/load";
import type {
  Expense,
  Goal,
  Household,
  IncomeSource,
  Owner,
  Valuation,
} from "@/lib/types";
import { TrendingUp, TrendingDown, Wallet, Landmark, Lightbulb } from "lucide-react";

const LEGAL_KINDS = ["trust", "llc", "corporation", "foundation", "estate"];

export function DashboardView({
  household,
  owners,
  portfolio,
  valuations,
  incomeSources,
  expenses,
  goals,
  earnedKeys,
}: {
  household: Household;
  owners: Owner[];
  portfolio: Portfolio;
  valuations: Valuation[];
  incomeSources: IncomeSource[];
  expenses: Expense[];
  goals: Goal[];
  earnedKeys: string[];
}) {
  const router = useRouter();
  const { ownerIds, includesOwner } = useScope();
  const { reportingCurrency, displayCurrency, rates, show, toDisplay } = useCurrency();
  const [seeding, setSeeding] = useState(false);
  const [celebration, setCelebration] = useState<{ title: string; description: string } | null>(null);
  const [allocView, setAllocView] = useState<"donut" | "treemap">("donut");
  const didInit = useRef(false);

  const reportingDigits = getMinorDigits(reportingCurrency);

  const isEmpty =
    portfolio.accounts.length === 0 &&
    portfolio.holdings.length === 0 &&
    portfolio.assets.length === 0 &&
    portfolio.liabilities.length === 0;

  // --- scoped figures (respect the owner selector) for the display panels ---
  const scoped = useMemo(() => filterPortfolio(portfolio, ownerIds), [portfolio, ownerIds]);
  const nw = useMemo(
    () =>
      computeNetWorth({
        reportingCurrency,
        rates,
        owners,
        accounts: scoped.accounts,
        holdings: scoped.holdings,
        assets: scoped.assets,
        liabilities: scoped.liabilities,
        ownership: scoped.ownership,
      }),
    [scoped, owners, reportingCurrency, rates],
  );

  // --- whole-household figures for score + achievements (scope-independent) ---
  const nwAll = useMemo(
    () =>
      computeNetWorth({
        reportingCurrency,
        rates,
        owners,
        accounts: portfolio.accounts,
        holdings: portfolio.holdings,
        assets: portfolio.assets,
        liabilities: portfolio.liabilities,
        ownership: portfolio.ownership,
      }),
    [portfolio, owners, reportingCurrency, rates],
  );

  const annualIncomeAll = useMemo(
    () =>
      incomeSources
        .filter((s) => s.is_active)
        .reduce((sum, s) => sum + toBase(annualize(s.expected_amount_minor, s.cadence), s.currency, reportingCurrency, rates), 0),
    [incomeSources, reportingCurrency, rates],
  );
  const annualExpensesAll = useMemo(
    () =>
      expenses.reduce((sum, e) => {
        const amt = e.is_recurring && e.cadence ? annualize(e.amount_minor, e.cadence) : e.amount_minor;
        return sum + toBase(amt, e.currency, reportingCurrency, rates);
      }, 0),
    [expenses, reportingCurrency, rates],
  );

  const health = useMemo(() => {
    const liquid = nwAll.byGroup.find((g) => g.group === "Cash & Equivalents")?.valueMinor ?? 0;
    const goalsWithTarget = goals.filter((g) => g.target_minor > 0);
    const goalFundingAvg =
      goalsWithTarget.length === 0
        ? null
        : goalsWithTarget.reduce((s, g) => s + Math.min(1, g.manual_saved_minor / g.target_minor), 0) /
          goalsWithTarget.length;
    const latest = valuations.length
      ? valuations.reduce((m, v) => (v.as_of_date > m ? v.as_of_date : m), valuations[0].as_of_date)
      : null;
    const daysSinceUpdate = latest
      ? Math.round((Date.now() - new Date(latest).getTime()) / 86400000)
      : null;
    return computeHealthScore({
      netWorthMinor: nwAll.netWorthMinor,
      totalAssetsMinor: nwAll.totalAssetsMinor,
      totalLiabilitiesMinor: nwAll.totalLiabilitiesMinor,
      liquidMinor: liquid,
      annualIncomeMinor: annualIncomeAll,
      annualExpensesMinor: annualExpensesAll,
      assetGroupCount: nwAll.byGroup.length,
      goalFundingAvg,
      daysSinceUpdate,
    });
  }, [nwAll, goals, valuations, annualIncomeAll, annualExpensesAll]);

  // evaluate achievements once on mount
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const supabase = createClient();

    if (!isEmpty) {
      const currencies = new Set<string>([
        ...portfolio.accounts.map((a) => a.currency),
        ...portfolio.holdings.map((h) => h.currency),
        ...portfolio.assets.map((a) => a.currency),
        ...portfolio.liabilities.map((l) => l.currency),
      ]);
      const earned = evaluateAchievements({
        accountCount: portfolio.accounts.length,
        assetGroupCount: nwAll.byGroup.length,
        hasTrustOrLlc: owners.some((o) => LEGAL_KINDS.includes(o.kind)),
        currencyCount: currencies.size,
        goalCount: goals.length,
        emergencyFunded: goals.some((g) => g.type === "emergency" && g.target_minor > 0 && g.manual_saved_minor >= g.target_minor),
        positiveCashFlow: annualIncomeAll - annualExpensesAll > 0,
        netWorthMajor: nwAll.netWorthMinor / 10 ** reportingDigits,
      });
      const fresh = earned.filter((k) => !earnedKeys.includes(k));
      if (fresh.length > 0) {
        supabase
          .from("achievements")
          .insert(fresh.map((key) => ({ household_id: household.id, key })))
          .then(() => {
            const def = ACHIEVEMENTS_BY_KEY[fresh[0]];
            setCelebration({
              title: fresh.length > 1 ? `${fresh.length} achievements unlocked!` : def?.title ?? "Achievement unlocked",
              description: fresh.length > 1 ? "View them on the Achievements page." : def?.description ?? "",
            });
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDemo() {
    setSeeding(true);
    await createClient().rpc("seed_demo_household", { p_household_id: household.id });
    router.refresh();
    setSeeding(false);
  }

  // display-major helpers for charts
  const digits = getMinorDigits(displayCurrency);
  const toMajorDisplay = (minorReporting: number) => toDisplay(minorReporting) / 10 ** digits;
  const fmtAxis = (major: number) =>
    formatMoney(Math.round(major * 10 ** digits), displayCurrency, { compact: true });
  // Count-up props for a reporting-currency minor amount, shown in display currency.
  const animMoney = (minorReporting: number) => ({
    numericValue: toMajorDisplay(minorReporting),
    format: (n: number) => formatMoney(Math.round(n * 10 ** digits), displayCurrency),
  });

  const scopedHoldableIds = useMemo(
    () =>
      new Set<string>([
        ...scoped.accounts.map((a) => a.id),
        ...scoped.holdings.map((h) => h.id),
        ...scoped.assets.map((a) => a.id),
        ...scoped.liabilities.map((l) => l.id),
      ]),
    [scoped],
  );

  const trend = useMemo(() => {
    const filtered = valuations.filter((v) => scopedHoldableIds.has(v.holdable_id));
    const hist = computeNetWorthHistory(filtered, reportingCurrency, rates, 24);
    return hist.map((p) => ({ label: p.date.slice(0, 7), value: toMajorDisplay(p.netWorthMinor) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuations, scopedHoldableIds, reportingCurrency, rates, displayCurrency]);

  const allocation = useMemo(
    () =>
      nw.byGroup.map((g) => ({
        name: g.group,
        value: toMajorDisplay(g.valueMinor),
        color: GROUP_COLORS[g.group] ?? "#94a3b8",
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nw, displayCurrency],
  );

  // Per-owner net-worth sparklines (keyed by owner id), in display major units.
  const ownerSpark = useMemo(() => {
    const ids = new Map<string, Set<string>>();
    const add = (owner: string, id: string) => {
      if (!ids.has(owner)) ids.set(owner, new Set());
      ids.get(owner)!.add(id);
    };
    const accOwner = new Map(scoped.accounts.map((a) => [a.id, a.owner_id]));
    scoped.accounts.forEach((a) => add(a.owner_id, a.id));
    scoped.holdings.forEach((h) => {
      const o = accOwner.get(h.account_id);
      if (o) add(o, h.id);
    });
    scoped.assets.forEach((a) => add(a.owner_id, a.id));
    scoped.liabilities.forEach((l) => add(l.owner_id, l.id));
    const out = new Map<string, { value: number }[]>();
    for (const [ownerId, set] of ids) {
      const vals = valuations.filter((v) => set.has(v.holdable_id));
      const hist = computeNetWorthHistory(vals, reportingCurrency, rates, 16);
      out.set(ownerId, hist.map((p) => ({ value: toMajorDisplay(p.netWorthMinor) })));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, valuations, reportingCurrency, rates, displayCurrency]);

  const annualIncome = useMemo(
    () =>
      incomeSources
        .filter((s) => s.is_active && includesOwner(s.owner_id))
        .reduce((sum, s) => sum + toBase(annualize(s.expected_amount_minor, s.cadence), s.currency, reportingCurrency, rates), 0),
    [incomeSources, includesOwner, reportingCurrency, rates],
  );
  const annualExpenses = useMemo(
    () =>
      expenses
        .filter((e) => includesOwner(e.owner_id))
        .reduce((sum, e) => {
          const amt = e.is_recurring && e.cadence ? annualize(e.amount_minor, e.cadence) : e.amount_minor;
          return sum + toBase(amt, e.currency, reportingCurrency, rates);
        }, 0),
    [expenses, includesOwner, reportingCurrency, rates],
  );

  const scopedGoals = goals.filter((g) => g.owner_id == null || includesOwner(g.owner_id));
  const netChange = trend.length >= 2 ? trend[trend.length - 1].value - trend[0].value : 0;

  const topInsights = useMemo(
    () =>
      computeInsights(
        buildInsightsInput({
          nw,
          goals: scopedGoals,
          liabilities: scoped.liabilities,
          owners,
          valuations,
          annualIncomeMinor: annualIncome,
          annualExpensesMinor: annualExpenses,
          reportingCurrency,
          rates,
        }),
      ).slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nw, scopedGoals, scoped, owners, valuations, annualIncome, annualExpenses, reportingCurrency, rates],
  );

  const setupSteps: SetupStep[] = [
    { label: "Add family members & entities", done: owners.length >= 2, href: "/family" },
    { label: "Add an account", done: portfolio.accounts.length > 0, href: "/accounts" },
    { label: "Add an asset", done: portfolio.assets.length > 0, href: "/assets" },
    { label: "Track a liability", done: portfolio.liabilities.length > 0, href: "/liabilities" },
    { label: "Record income or expenses", done: incomeSources.length > 0 || expenses.length > 0, href: "/cashflow" },
    { label: "Set a goal", done: goals.length > 0, href: "/goals" },
  ];

  return (
    <div>
      <Celebration
        title={celebration?.title ?? null}
        description={celebration?.description}
        onDone={() => setCelebration(null)}
      />

      <GettingStarted steps={setupSteps} onLoadDemo={isEmpty ? loadDemo : undefined} seeding={seeding} />

      {nw.missingRates && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          Some items use a currency without an exchange rate &mdash; they&apos;re counted
          1:1 for now. Add rates in Settings &rarr; Exchange rates.
        </div>
      )}

      <div className="mt-6">
        <NetWorthHero
          householdName={household.name}
          {...animMoney(nw.netWorthMinor)}
          positive={nw.netWorthMinor >= 0}
          deltaLabel={
            netChange !== 0
              ? `${show(Math.round(Math.abs(netChange) * 10 ** digits))} over period`
              : undefined
          }
          spark={trend.map((t) => ({ value: t.value }))}
          note={displayCurrency !== reportingCurrency ? `Reporting currency: ${reportingCurrency}` : undefined}
        />
      </div>

      <Stagger className="mt-4 grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <StatCard label="Total Assets" {...animMoney(nw.totalAssetsMinor)} sub={`${nw.items.filter((i) => i.baseMinor > 0).length} holdings`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Total Liabilities" {...animMoney(nw.totalLiabilitiesMinor)} accent={nw.totalLiabilitiesMinor > 0 ? "negative" : "default"} sub={`${scoped.liabilities.length} debts`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Annual Net Cash Flow" {...animMoney(annualIncome - annualExpenses)} accent={annualIncome - annualExpenses >= 0 ? "positive" : "negative"} sub={`${show(annualIncome)} in / ${show(annualExpenses)} out`} />
        </StaggerItem>
      </Stagger>

      {!isEmpty && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-2" delay={0.05}>
            <Card className="elev h-full">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Financial Health Score</CardTitle>
                <span className="text-xs text-muted-foreground">Whole family</span>
              </CardHeader>
              <CardContent>
                <HealthScoreCard result={health} />
                {health.topTip && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-accent/60 p-3 text-sm">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <span><span className="font-medium">Improve next:</span> {health.topTip}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="h-full">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Top insights</CardTitle>
                <Link href="/insights" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {topInsights.length > 0 ? (
                  <InsightsMini insights={topInsights} />
                ) : (
                  <p className="text-sm text-muted-foreground">No insights right now.</p>
                )}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Net worth over time</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length >= 2 ? (
              <TrendChart data={trend} formatValue={fmtAxis} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Add accounts and assets to see your net worth trend build over time.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Asset allocation</CardTitle>
            {allocation.length > 0 && (
              <div className="flex rounded-md border p-0.5 text-xs">
                <button
                  onClick={() => setAllocView("donut")}
                  className={`rounded px-2 py-0.5 transition-colors ${allocView === "donut" ? "bg-accent font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  Donut
                </button>
                <button
                  onClick={() => setAllocView("treemap")}
                  className={`rounded px-2 py-0.5 transition-colors ${allocView === "treemap" ? "bg-accent font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  Treemap
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {allocation.length > 0 ? (
              <>
                {allocView === "donut" ? (
                  <AllocationDonut
                    data={allocation}
                    formatValue={fmtAxis}
                    centerSub="Assets"
                    centerLabel={fmtAxis(toMajorDisplay(nw.totalAssetsMinor))}
                  />
                ) : (
                  <AllocationTreemap data={allocation} formatValue={fmtAxis} />
                )}
                <div className="mt-3 space-y-1.5">
                  {allocation.map((a) => (
                    <div key={a.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {Math.round((a.value / allocation.reduce((s, x) => s + x.value, 0)) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No assets yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By member &amp; entity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nw.byOwner.length === 0 && <p className="text-sm text-muted-foreground">No holdings yet.</p>}
            {nw.byOwner.map((o) => {
              const pct = nw.netWorthMinor > 0 ? Math.round((o.netMinor / nw.netWorthMinor) * 100) : 0;
              const spark = ownerSpark.get(o.ownerId) ?? [];
              return (
                <div key={o.ownerId}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{o.ownerName}</span>
                    <span className="tabular-nums">{show(o.netMinor)}</span>
                  </div>
                  {spark.length >= 2 ? (
                    <div className="mt-1 h-8">
                      <Sparkline data={spark} color={o.netMinor >= 0 ? "#2E7D5B" : "#8C3B4A"} height={32} />
                    </div>
                  ) : (
                    <Progress value={Math.max(0, Math.min(100, pct))} className="mt-1.5" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Goals</CardTitle>
          </CardHeader>
          <CardContent>
            {scopedGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No goals yet. Set up an education fund, emergency fund, or retirement target in the Goals tab.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {scopedGoals.slice(0, 4).map((g) => {
                  const saved = toBase(g.manual_saved_minor, g.currency, reportingCurrency, rates);
                  const target = toBase(g.target_minor, g.currency, reportingCurrency, rates);
                  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
                  return (
                    <div key={g.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{g.name}</span>
                        <span className="text-xs text-muted-foreground">{GOAL_TYPE_LABELS[g.type]}</span>
                      </div>
                      <Progress value={pct} className="mt-2" indicatorClassName={pct >= 100 ? "bg-success" : "bg-gold"} />
                      <p className="mt-1.5 text-xs text-muted-foreground">{show(saved)} of {show(target)} ({pct}%)</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickStat icon={Wallet} label="Accounts" value={scoped.accounts.length} />
        <QuickStat icon={TrendingUp} label="Holdings" value={scoped.holdings.length} />
        <QuickStat icon={Landmark} label="Assets" value={scoped.assets.length} />
        <QuickStat icon={TrendingDown} label="Liabilities" value={scoped.liabilities.length} />
      </div>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-gold/10 p-2 text-gold">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
