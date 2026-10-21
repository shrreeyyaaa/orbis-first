"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/motion/animated-number";
import type { HealthResult, Tier } from "@/lib/health-score";

const TIER_COLOR: Record<Tier, string> = {
  Bronze: "#B5734A",
  Silver: "#8C97A8",
  Gold: "#C29A4E",
  Platinum: "#3E7C86",
};

export function ScoreRing({
  value,
  tier,
  size = 132,
}: {
  value: number;
  tier: Tier;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = TIER_COLOR[tier];

  // Animate the arc filling in on mount.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(t);
  }, [value]);
  const offset = c * (1 - Math.max(0, Math.min(100, shown)) / 100);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber
          value={value}
          format={(n) => String(Math.round(n))}
          className="font-serif text-3xl font-semibold tabular-nums leading-none"
        />
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide" style={{ color }}>
          {tier}
        </span>
      </div>
    </div>
  );
}

export function HealthScoreCard({
  result,
  className,
}: {
  result: HealthResult;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-center", className)}>
      <div className="flex shrink-0 justify-center">
        <ScoreRing value={result.score} tier={result.tier} />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {result.dimensions.map((d) => (
          <div key={d.key}>
            <div className="flex items-center justify-between text-sm">
              <span>{d.label}</span>
              <span className="text-xs text-muted-foreground">{d.detail}</span>
            </div>
            <Progress
              value={Math.round(d.score * 100)}
              className="mt-1 h-1.5"
              indicatorClassName={d.score >= 0.66 ? "bg-success" : d.score >= 0.33 ? "bg-gold" : "bg-destructive"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}