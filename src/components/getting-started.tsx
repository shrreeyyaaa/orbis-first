"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Check, Circle, Sparkles } from "lucide-react";

export interface SetupStep {
  label: string;
  done: boolean;
  href: string;
}

export function GettingStarted({
  steps,
  onLoadDemo,
  seeding,
}: {
  steps: SetupStep[];
  onLoadDemo?: () => void;
  seeding?: boolean;
}) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  if (pct === 100) return null;

  return (
    <Card className="relative overflow-hidden">
      <div className="gold-rule absolute inset-x-0 top-0 h-0.5" />
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Set up your family office</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {done} of {steps.length} complete &middot; finish to unlock your full picture.
          </p>
        </div>
        {onLoadDemo && (
          <Button variant="gold" size="sm" onClick={onLoadDemo} disabled={seeding}>
            <Sparkles className="h-4 w-4" />
            {seeding ? "Loading…" : "Load sample data"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Progress value={pct} indicatorClassName="bg-gold" className="mb-4" />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {steps.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                s.done ? "text-muted-foreground" : ""
              }`}
            >
              {s.done ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40" />
              )}
              <span className={s.done ? "line-through" : ""}>{s.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
