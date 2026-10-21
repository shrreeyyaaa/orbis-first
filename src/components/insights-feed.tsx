"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import type { Insight, InsightSeverity } from "@/lib/insights";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const META: Record<
  InsightSeverity,
  { icon: React.ComponentType<{ className?: string }>; tone: string; ring: string }
> = {
  critical: { icon: AlertOctagon, tone: "text-destructive", ring: "bg-destructive/10" },
  warn: { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400", ring: "bg-amber-500/10" },
  info: { icon: Info, tone: "text-primary", ring: "bg-primary/10" },
  positive: { icon: CheckCircle2, tone: "text-success", ring: "bg-success/10" },
};

export function InsightsFeed({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="mb-3 h-9 w-9 text-success" />
          <p className="font-medium">Nothing needs your attention</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add more of your finances to surface tailored insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((it, i) => {
        const m = META[it.severity];
        const Icon = m.icon;
        return (
          <Reveal key={it.id} delay={Math.min(i * 0.04, 0.3)}>
            <Card className="card-hover">
              <CardContent className="flex items-start gap-3 p-4">
                <div className={`mt-0.5 rounded-lg p-2 ${m.ring}`}>
                  <Icon className={`h-5 w-5 ${m.tone}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{it.title}</p>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {it.category}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{it.detail}</p>
                  {it.href && (
                    <Link
                      href={it.href}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      {it.actionLabel ?? "View"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}

/** Compact list for the dashboard (no cards, no links). */
export function InsightsMini({ insights }: { insights: Insight[] }) {
  return (
    <div className="space-y-2.5">
      {insights.map((it) => {
        const m = META[it.severity];
        const Icon = m.icon;
        return (
          <div key={it.id} className="flex items-start gap-2.5">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${m.tone}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{it.title}</p>
              <p className="truncate text-xs text-muted-foreground">{it.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
