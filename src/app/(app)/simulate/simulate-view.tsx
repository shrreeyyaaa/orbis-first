"use client";
import { useMemo, useState } from "react";
import { useScope } from "@/components/scope-context";
import { useCurrency } from "@/components/currency-context";
import { filterPortfolio } from "@/lib/scope";
import { computeNetWorth } from "@/lib/networth";
import { getRate } from "@/lib/fx";
import { getMinorDigits, formatMoney, toMinor } from "@/lib/currency";
import {
  projectNetWorth,
  forwardFromDrift,
  forwardFromIRP,
  breakEvenRate,
  fxSensitivity,
} from "@/lib/simulation";
import { ALLOCATION_GROUPS, GROUP_COLORS } from "@/lib/labels";
import { CURRENCIES } from "@/lib/currency";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, EnumSelect } from "@/components/form-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MultiTrendChart, FanChart } from "@/components/charts";
import { blendAssumptions } from "@/lib/assumptions";
import { runMonteCarlo } from "@/lib/montecarlo";
import type { NetWorthResult } from "@/lib/networth";
import type { Owner } from "@/lib/types";
import type { Portfolio } from "@/lib/load";
import { Plus, Trash2, RotateCcw } from "lucide-react";

const DEFAULT_GROWTH: Record<string, number> = {
  "Cash & Equivalents": 2,
  "Public Equities": 7,
  "Fixed Income": 4,
  "Real Estate": 4,
  "Private & Alternatives": 12,
  Crypto: 0,
  "Physical & Collectibles": 2,
  "Insurance & Annuities": 3,
  Other: 3,
  Liabilities: 0,
};

interface Hypo {
  id: string;
  label: string;
  group: string;
  valueMajor: string;
  growth: string;
}

export function SimulateView({
  owners,
  portfolio,
}: {
  owners: Owner[];
  portfolio: Portfolio;
}) {
  const { ownerIds } = useScope();
  const { reportingCurrency, displayCurrency, rates, show, toDisplay } = useCurrency();

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

  // group totals (assets positive groups + liabilities group negative)
  const groupTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of nw.items) m.set(it.group, (m.get(it.group) ?? 0) + it.baseMinor);
    return m;
  }, [nw]);

  const activeGroups = [...ALLOCATION_GROUPS, "Liabilities"].filter((g) =>
    groupTotals.has(g),
  );

  // ---- projection state ----
  const [growth, setGrowth] = useState<Record<string, number>>(DEFAULT_GROWTH);
  const [years, setYears] = useState(10);
  const [inflation, setInflation] = useState(2.5);
  const [contribution, setContribution] = useState("");
  const [contribReturn, setContribReturn] = useState(6);
  const [hypos, setHypos] = useState<Hypo[]>([]);

  const digits = getMinorDigits(displayCurrency);
  const fmtAxis = (major: number) =>
    formatMoney(Math.round(major * 10 ** digits), displayCurrency, { compact: true });

  const projection = useMemo(() => {
    const lines = activeGroups.map((g) => ({
      valueMinor: groupTotals.get(g) ?? 0,
      growthPct: growth[g] ?? 0,
    }));
    for (const h of hypos) {
      const v = Number(toMinor(h.valueMajor || "0", reportingCurrency));
      lines.push({ valueMinor: v, growthPct: Number(h.growth || "0") });
    }
    const monthly = Number(toMinor(contribution || "0", reportingCurrency));
    const pts = projectNetWorth({
      lines,
      years,
      inflationPct: inflation,
      monthlyContributionMinor: monthly,
      contributionReturnPct: contribReturn,
    });
    return pts.map((p) => ({
      label: `Y${p.year}`,
      Nominal: toDisplay(p.nominalMinor) / 10 ** digits,
      "Real (today's value)": toDisplay(p.realMinor) / 10 ** digits,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroups, groupTotals, growth, hypos, years, inflation, contribution, contribReturn, reportingCurrency, displayCurrency, rates]);

  const startNominal = projection[0]?.Nominal ?? 0;
  const endNominal = projection[projection.length - 1]?.Nominal ?? 0;
  const endReal = projection[projection.length - 1]?.["Real (today's value)"] ?? 0;
  const toMinorDisplay = (major: number) => Math.round(major * 10 ** digits);

  return (
    <div>
      <PageHeader
        title="Simulate"
        description="A non-destructive sandbox. Play with assumptions and future exchange rates — your real data never changes."
      />

      <Tabs defaultValue="projection">
        <TabsList>
          <TabsTrigger value="projection">Net-worth projection</TabsTrigger>
          <TabsTrigger value="montecarlo">Monte Carlo</TabsTrigger>
          <TabsTrigger value="fx">Future currency converter</TabsTrigger>
        </TabsList>

        <TabsContent value="projection" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Net worth today" value={formatMoney(toMinorDisplay(startNominal), displayCurrency)} />
            <StatCard
              label={`Projected in ${years}y (nominal)`}
              value={formatMoney(toMinorDisplay(endNominal), displayCurrency)}
              accent="positive"
            />
            <StatCard
              label={`In ${years}y (today's value)`}
              value={formatMoney(toMinorDisplay(endReal), displayCurrency)}
              sub="Inflation-adjusted"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Projected net worth</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiTrendChart
                data={projection}
                series={[
                  { key: "Nominal", color: "#1A2C4E" },
                  { key: "Real (today's value)", color: "#2E7D5B" },
                ]}
                formatValue={fmtAxis}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Global assumptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label={`Horizon: ${years} years`}>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Inflation %">
                    <Input
                      inputMode="decimal"
                      value={inflation}
                      onChange={(e) => setInflation(Number(e.target.value) || 0)}
                    />
                  </Field>
                  <Field label="Contribution return %">
                    <Input
                      inputMode="decimal"
                      value={contribReturn}
                      onChange={(e) => setContribReturn(Number(e.target.value) || 0)}
                    />
                  </Field>
                </div>
                <Field label={`Monthly contribution (${reportingCurrency})`} hint="Recurring savings added and compounded at the return above.">
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    value={contribution}
                    onChange={(e) => setContribution(e.target.value)}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Growth by asset class</CardTitle>
                <CardDescription>Annual % applied to each bucket.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeGroups.map((g) => (
                  <div key={g} className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ background: GROUP_COLORS[g] ?? "#94a3b8" }} />
                    <span className="flex-1 text-sm">{g}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {show(groupTotals.get(g) ?? 0)}
                    </span>
                    <Input
                      className="w-20"
                      inputMode="decimal"
                      value={growth[g] ?? 0}
                      onChange={(e) =>
                        setGrowth((prev) => ({ ...prev, [g]: Number(e.target.value) || 0 }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Hypothetical assets</CardTitle>
                <CardDescription>Model buying or receiving new assets.</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  setHypos((h) => [
                    ...h,
                    {
                      id: Math.random().toString(36).slice(2),
                      label: "New asset",
                      group: "Public Equities",
                      valueMajor: "",
                      growth: "7",
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {hypos.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hypothetical assets. Add one to see how a future purchase or windfall changes the trajectory.
                </p>
              )}
              {hypos.map((h) => (
                <div key={h.id} className="flex flex-wrap items-end gap-2">
                  <Field label="Label">
                    <Input
                      className="w-40"
                      value={h.label}
                      onChange={(e) =>
                        setHypos((prev) => prev.map((x) => (x.id === h.id ? { ...x, label: e.target.value } : x)))
                      }
                    />
                  </Field>
                  <Field label="Class">
                    <div className="w-44">
                      <EnumSelect
                        value={h.group}
                        onChange={(v) =>
                          setHypos((prev) => prev.map((x) => (x.id === h.id ? { ...x, group: v } : x)))
                        }
                        options={Object.fromEntries(ALLOCATION_GROUPS.map((g) => [g, g]))}
                      />
                    </div>
                  </Field>
                  <Field label={`Value (${reportingCurrency})`}>
                    <Input
                      className="w-32"
                      inputMode="decimal"
                      value={h.valueMajor}
                      onChange={(e) =>
                        setHypos((prev) => prev.map((x) => (x.id === h.id ? { ...x, valueMajor: e.target.value } : x)))
                      }
                    />
                  </Field>
                  <Field label="Growth %">
                    <Input
                      className="w-20"
                      inputMode="decimal"
                      value={h.growth}
                      onChange={(e) =>
                        setHypos((prev) => prev.map((x) => (x.id === h.id ? { ...x, growth: e.target.value } : x)))
                      }
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setHypos((prev) => prev.filter((x) => x.id !== h.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="montecarlo">
          <MonteCarloTab startMinor={nw.netWorthMinor} byGroup={nw.byGroup} />
        </TabsContent>

        <TabsContent value="fx">
          <FxWhatIf
            defaultAmountMinor={Math.max(0, nw.netWorthMinor)}
            reportingCurrency={reportingCurrency}
            ratesGetter={(from, to) => getRate(rates, from, to)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MonteCarloTab({
  startMinor,
  byGroup,
}: {
  startMinor: number;
  byGroup: NetWorthResult["byGroup"];
}) {
  const { reportingCurrency, displayCurrency, show, toDisplay } = useCurrency();
  const blended = useMemo(() => blendAssumptions(byGroup), [byGroup]);

  const [expReturn, setExpReturn] = useState(blended.expectedReturnPct);
  const [vol, setVol] = useState(blended.volatilityPct);
  const [years, setYears] = useState(20);
  const [runs, setRuns] = useState(1000);
  const [inflation, setInflation] = useState(2.5);
  const [contribution, setContribution] = useState("");
  const [target, setTarget] = useState("");

  const digits = getMinorDigits(displayCurrency);
  const fmtAxis = (major: number) =>
    formatMoney(Math.round(major * 10 ** digits), displayCurrency, { compact: true });
  const toMajorDisplay = (minorReporting: number) => toDisplay(minorReporting) / 10 ** digits;

  const result = useMemo(
    () =>
      runMonteCarlo({
        startMinor,
        years,
        runs,
        expectedReturnPct: expReturn,
        volatilityPct: vol,
        monthlyContributionMinor: Number(toMinor(contribution || "0", reportingCurrency)),
        inflationPct: inflation,
        targetMinor: target ? Number(toMinor(target, reportingCurrency)) : null,
      }),
    [startMinor, years, runs, expReturn, vol, contribution, inflation, target, reportingCurrency],
  );

  const fan = result.points.map((p) => ({
    label: `Y${p.year}`,
    p10: toMajorDisplay(p.p10),
    p25: toMajorDisplay(p.p25),
    p50: toMajorDisplay(p.p50),
    p75: toMajorDisplay(p.p75),
    p90: toMajorDisplay(p.p90),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={`Median in ${years}y`} value={show(result.medianEnding)} accent="positive" hairline />
        <StatCard label="Range (10-90%)" value={show(result.p10Ending)} sub={`to ${show(result.p90Ending)}`} />
        <StatCard label="Median in today's money" value={show(result.realMedianEnding)} sub="Inflation-adjusted" />
        <StatCard
          label="Chance above today"
          value={`${Math.round(result.probAboveStart * 100)}%`}
          accent="positive"
          sub={result.probAboveTarget != null ? `${Math.round(result.probAboveTarget * 100)}% above target` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Range of outcomes</CardTitle>
          <CardDescription>
            {runs.toLocaleString()} simulations. Shaded bands show the 10th-90th percentile; the line is the median.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FanChart data={fan} formatValue={fmtAxis} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Return assumptions</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpReturn(blended.expectedReturnPct);
                setVol(blended.volatilityPct);
              }}
            >
              <RotateCcw className="h-4 w-4" /> From my allocation
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <CardDescription>
              Prefilled from your current mix ({blended.expectedReturnPct}% return, {blended.volatilityPct}% volatility).
            </CardDescription>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expected return %">
                <Input inputMode="decimal" value={expReturn} onChange={(e) => setExpReturn(Number(e.target.value) || 0)} />
              </Field>
              <Field label="Volatility %">
                <Input inputMode="decimal" value={vol} onChange={(e) => setVol(Number(e.target.value) || 0)} />
              </Field>
            </div>
            <Field label="Inflation %">
              <Input inputMode="decimal" value={inflation} onChange={(e) => setInflation(Number(e.target.value) || 0)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={`Horizon: ${years} years`}>
              <input
                type="range"
                min={1}
                max={40}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Monthly contribution (${reportingCurrency})`}>
                <Input inputMode="decimal" placeholder="0" value={contribution} onChange={(e) => setContribution(e.target.value)} />
              </Field>
              <Field label={`Target (${reportingCurrency})`} hint="Optional - chance of finishing above it">
                <Input inputMode="decimal" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} />
              </Field>
            </div>
            <Field label="Simulations">
              <EnumSelect
                value={String(runs)}
                onChange={(v) => setRuns(Number(v))}
                options={{ "500": "500", "1000": "1,000", "5000": "5,000" }}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Hypothetical projection using random annual returns from the assumptions above. Not a prediction or
        guarantee; liabilities are held constant.
      </p>
    </div>
  );
}

function FxWhatIf({
  defaultAmountMinor,
  reportingCurrency,
  ratesGetter,
}: {
  defaultAmountMinor: number;
  reportingCurrency: string;
  ratesGetter: (from: string, to: string) => number | null;
}) {
  const [from, setFrom] = useState(reportingCurrency);
  const [to, setTo] = useState(reportingCurrency === "USD" ? "EUR" : "USD");
  const [amount, setAmount] = useState(
    (defaultAmountMinor / 10 ** getMinorDigits(reportingCurrency)).toFixed(0),
  );
  const [years, setYears] = useState(5);
  const [method, setMethod] = useState<"drift" | "irp">("drift");
  const [drift, setDrift] = useState(0);
  const [baseRate, setBaseRate] = useState(4);
  const [quoteRate, setQuoteRate] = useState(2);
  const [baseInfl, setBaseInfl] = useState(2.5);
  const [quoteInfl, setQuoteInfl] = useState(2);

  const detectedSpot = ratesGetter(from, to);
  const [spotInput, setSpotInput] = useState<string>("");
  const spot = spotInput !== "" ? Number(spotInput) : detectedSpot ?? 1;

  const amountMajor = Number(amount || "0");
  const forward =
    method === "drift"
      ? forwardFromDrift(spot, drift, years)
      : forwardFromIRP(spot, baseRate, quoteRate, years);
  const breakEven = breakEvenRate(spot, baseInfl, quoteInfl, years);
  const sensitivity = fxSensitivity(amountMajor, spot);

  const fmtFrom = (major: number) =>
    formatMoney(Math.round(major * 10 ** getMinorDigits(from)), from);
  const fmtTo = (major: number) =>
    formatMoney(Math.round(major * 10 ** getMinorDigits(to)), to);

  const favorable = forward >= breakEven;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Future currency converter</CardTitle>
          <CardDescription>
            Estimate a future exchange rate and find the &ldquo;right&rdquo; rate to convert at.
            Rates are expressed as units of {to} per 1 {from}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="From">
              <CcySelect value={from} onChange={setFrom} />
            </Field>
            <Field label="To">
              <CcySelect value={to} onChange={setTo} />
            </Field>
            <Field label={`Amount (${from})`}>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label={`Spot rate (1 ${from} = ? ${to})`} hint={detectedSpot ? "Auto-filled from your saved rates" : "No saved rate — enter one"}>
              <Input
                inputMode="decimal"
                placeholder={detectedSpot ? detectedSpot.toFixed(4) : "1.0000"}
                value={spotInput}
                onChange={(e) => setSpotInput(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={`Horizon: ${years}y`}>
              <input
                type="range"
                min={1}
                max={30}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </Field>
            <Field label="Method">
              <EnumSelect
                value={method}
                onChange={setMethod}
                options={{ drift: "Annual drift", irp: "Interest-rate parity" }}
              />
            </Field>
            {method === "drift" ? (
              <Field label="Annual drift %">
                <Input inputMode="decimal" value={drift} onChange={(e) => setDrift(Number(e.target.value) || 0)} />
              </Field>
            ) : (
              <>
                <Field label={`${from} interest %`}>
                  <Input inputMode="decimal" value={baseRate} onChange={(e) => setBaseRate(Number(e.target.value) || 0)} />
                </Field>
                <Field label={`${to} interest %`}>
                  <Input inputMode="decimal" value={quoteRate} onChange={(e) => setQuoteRate(Number(e.target.value) || 0)} />
                </Field>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`${from} inflation % (for break-even)`}>
              <Input inputMode="decimal" value={baseInfl} onChange={(e) => setBaseInfl(Number(e.target.value) || 0)} />
            </Field>
            <Field label={`${to} inflation % (for break-even)`}>
              <Input inputMode="decimal" value={quoteInfl} onChange={(e) => setQuoteInfl(Number(e.target.value) || 0)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {from !== to && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Convert today" value={fmtTo(amountMajor * spot)} sub={`at ${spot.toFixed(4)}`} />
            <StatCard
              label={`Projected rate in ${years}y`}
              value={`${forward.toFixed(4)}`}
              sub={`${fmtTo(amountMajor * forward)}`}
            />
            <StatCard
              label="Break-even rate"
              value={breakEven.toFixed(4)}
              accent={favorable ? "positive" : "negative"}
              sub={favorable ? "Projected beats break-even" : "Projected below break-even"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>The &ldquo;right&rdquo; rate to convert at</CardTitle>
              <CardDescription>
                Above {breakEven.toFixed(4)} {to}/{from}, waiting and converting later
                preserves more purchasing power than converting today. Your projected
                rate is {forward.toFixed(4)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Future rate</th>
                      <th className="py-2">You receive ({to})</th>
                      <th className="py-2">vs converting today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.map((s) => {
                      const isBreak = s.rate >= breakEven;
                      return (
                        <tr key={s.rate} className="border-b">
                          <td className="py-1.5 tabular-nums">{s.rate.toFixed(4)}</td>
                          <td className="py-1.5 tabular-nums">
                            {formatMoney(s.quoteMinor, to)}
                          </td>
                          <td
                            className={`py-1.5 tabular-nums ${
                              s.deltaVsSpot >= 0 ? "text-success" : "text-destructive"
                            }`}
                          >
                            {s.deltaVsSpot >= 0 ? "+" : ""}
                            {formatMoney(s.deltaVsSpot, to)}
                            {isBreak ? " ✓" : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function CcySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
