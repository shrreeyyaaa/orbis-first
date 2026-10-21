"use client";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function NetWorthHero({
  householdName,
  numericValue,
  format,
  deltaLabel,
  positive,
  spark,
  note,
}: {
  householdName: string;
  numericValue: number;
  format: (n: number) => string;
  deltaLabel?: string;
  positive: boolean;
  spark: { value: number }[];
  note?: string;
}) {
  return (
    <div className="elev relative overflow-hidden rounded-2xl border bg-card">
      {/* soft gold wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 120% at 100% 0%, hsl(var(--gold) / 0.16), transparent 55%)",
        }}
      />
      <div className="gold-rule absolute inset-x-0 top-0 h-0.5" />
      <div className="relative flex flex-wrap items-center justify-between gap-6 p-6 sm:p-7">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {greeting()} &middot; <span className="font-medium text-foreground">{householdName}</span>
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total net worth
          </p>
          <AnimatedNumber
            value={numericValue}
            format={format}
            duration={1.1}
            className="mt-1 block font-serif text-4xl font-semibold tabular-nums sm:text-5xl"
          />
          {deltaLabel && (
            <p
              className={`mt-2 inline-flex items-center gap-1 text-sm ${
                positive ? "text-success" : "text-destructive"
              }`}
            >
              {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {deltaLabel}
            </p>
          )}
          {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
        </div>

        {spark.length >= 2 && (
          <div className="h-20 w-40 shrink-0 sm:w-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 6, bottom: 6, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--gold))"
                  strokeWidth={2}
                  fill="url(#heroSpark)"
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
