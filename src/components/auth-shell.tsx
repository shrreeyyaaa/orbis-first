import { LineChart } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="absolute right-3 top-3 z-10">
        <ThemeToggle />
      </div>
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        {/* subtle radial sheen */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(120% 80% at 80% 0%, hsl(38 52% 50% / 0.18), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <LineChart className="h-6 w-6 text-gold" />
          <span className="font-serif text-xl tracking-tight">Orbis</span>
        </div>
        <div className="relative space-y-5">
          <div className="gold-rule h-px w-16" />
          <h2 className="font-serif text-4xl font-medium leading-tight">
            Your family&apos;s entire net worth, in one clear picture.
          </h2>
          <p className="max-w-md text-primary-foreground/75">
            Track every account, investment, property, and private holding across
            family members and trusts &mdash; in any currency, converted to one
            reporting currency you control.
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/55">
          Multi-currency &middot; Trusts &amp; LLCs &middot; What-if simulations
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center lg:hidden">
            <div className="flex items-center justify-center gap-2 text-lg font-semibold">
              <LineChart className="h-6 w-6 text-gold" />
              <span className="font-serif text-xl">Orbis</span>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
