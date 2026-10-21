import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/motion/animated-number";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  numericValue,
  format,
  sub,
  accent,
  className,
  hairline,
}: {
  label: string;
  value?: React.ReactNode;
  /** When provided with `format`, the figure counts up on mount/change. */
  numericValue?: number;
  format?: (n: number) => string;
  sub?: React.ReactNode;
  accent?: "default" | "positive" | "negative";
  className?: string;
  hairline?: boolean;
}) {
  return (
    <Card className={cn("card-hover relative h-full overflow-hidden", className)}>
      {hairline && <div className="gold-rule absolute inset-x-0 top-0 h-0.5" />}
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-1.5 font-serif text-2xl font-semibold tabular-nums",
            accent === "positive" && "text-success",
            accent === "negative" && "text-destructive",
          )}
        >
          {numericValue !== undefined && format ? (
            <AnimatedNumber value={numericValue} format={format} />
          ) : (
            value
          )}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      {Icon && <Icon className="mb-3 h-10 w-10 text-muted-foreground/50" />}
      <h3 className="text-base font-medium">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
