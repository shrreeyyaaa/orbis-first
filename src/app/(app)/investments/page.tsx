import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { InvestmentsView } from "./investments-view";
import type { Account, Asset, Holding } from "@/lib/types";

export default async function InvestmentsPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const [accounts, holdings, assets] = await Promise.all([
    supabase.from("accounts").select("*").eq("household_id", ctx.household.id).order("name"),
    supabase.from("holdings").select("*").eq("household_id", ctx.household.id),
    supabase.from("assets").select("*").eq("household_id", ctx.household.id),
  ]);

  return (
    <InvestmentsView
      householdId={ctx.household.id}
      owners={ctx.owners}
      accounts={(accounts.data ?? []) as Account[]}
      holdings={(holdings.data ?? []) as Holding[]}
      assets={(assets.data ?? []) as Asset[]}
    />
  );
}
