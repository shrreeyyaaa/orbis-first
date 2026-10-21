import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHouseholdContext } from "@/lib/household";
import { AppShell } from "@/components/app-shell";
import type { ExchangeRate } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const { data: rates } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("household_id", ctx.household.id);

  return (
    <AppShell
      household={ctx.household}
      owners={ctx.owners}
      exchangeRates={(rates ?? []) as ExchangeRate[]}
      displayCurrency={ctx.member.display_currency}
      userEmail={ctx.userEmail}
    >
      {children}
    </AppShell>
  );
}
