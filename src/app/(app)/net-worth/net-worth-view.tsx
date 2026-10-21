"use client";
import { useMemo } from "react";
import { useScope } from "@/components/scope-context";
import { useCurrency } from "@/components/currency-context";
import { filterPortfolio } from "@/lib/scope";
import { computeNetWorth, computeNetWorthHistory } from "@/lib/networth";
import { getMinorDigits, formatMoney } from "@/lib/currency";
import { GROUP_COLORS, ASSET_CLASS_LABELS } from "@/lib/labels";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendChart } from "@/components/charts";
import type { Portfolio } from "@/lib/load";
import type { Owner, Valuation, HoldableType } from "@/lib/types";

const KIND_LABEL: Record<HoldableType, string> = {
  account: "Cash",
  holding: "Investment",
  asset: "Asset",
  liability: "Liability",
};

export function NetWorthView({
  owners,
  portfolio,
  valuations,
}: {
  owners: Owner[];
  portfolio: Portfolio;
  valuations: Valuation[];
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

  const digits = getMinorDigits(displayCurrency);
  const fmtAxis = (major: number) =>
    formatMoney(Math.round(major * 10 ** digits), displayCurrency, { compact: true });

  const scopedIds = useMemo(
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
    const filtered = valuations.filter((v) => scopedIds.has(v.holdable_id));
    return computeNetWorthHistory(filtered, reportingCurrency, rates, 30).map((p) => ({
      label: p.date.slice(0, 7),
      value: toDisplay(p.netWorthMinor) / 10 ** digits,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuations, scopedIds, reportingCurrency, rates, displayCurrency]);

  const sortedItems = [...nw.items].sort((a, b) => b.baseMinor - a.baseMinor);

  return (
    <div>
      <PageHeader title="Net Worth" description="A full breakdown of what you own and owe." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Net worth" value={show(nw.netWorthMinor)} accent={nw.netWorthMinor >= 0 ? "positive" : "negative"} />
        <StatCard label="Assets" value={show(nw.totalAssetsMinor)} />
        <StatCard label="Liabilities" value={show(nw.totalLiabilitiesMinor)} accent="negative" />
      </div>

      {trend.length >= 2 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} formatValue={fmtAxis} />
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By asset class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nw.byGroup.map((g) => {
              const pct = nw.totalAssetsMinor > 0 ? Math.round((g.valueMinor / nw.totalAssetsMinor) * 100) : 0;
              return (
                <div key={g.group} className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: GROUP_COLORS[g.group] }} />
                  <span className="flex-1 text-sm">{g.group}</span>
                  <span className="text-sm tabular-nums">{show(g.valueMinor)}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By member &amp; entity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nw.byOwner.map((o) => (
              <div key={o.ownerId} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{o.ownerName}</span>
                <span className="text-sm tabular-nums">{show(o.netMinor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {sortedItems.map((it) => (
              <div key={`${it.kind}:${it.id}`} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABEL[it.kind]}
                    {it.assetClass ? ` · ${ASSET_CLASS_LABELS[it.assetClass]}` : ""}
                    {it.nativeCurrency !== reportingCurrency
                      ? ` · ${formatMoney(it.nativeMinor, it.nativeCurrency)}`
                      : ""}
                  </p>
                </div>
                {it.missingRate && <Badge variant="destructive">No FX rate</Badge>}
                <span className={`text-sm font-semibold tabular-nums ${it.baseMinor < 0 ? "text-destructive" : ""}`}>
                  {show(it.baseMinor)}
                </span>
              </div>
            ))}
            {sortedItems.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No holdings in scope.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
