import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { AccountsView } from "./accounts-view";
import type { Account, Institution } from "@/lib/types";

export default async function AccountsPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const [accounts, institutions] = await Promise.all([
    supabase.from("accounts").select("*").eq("household_id", ctx.household.id).order("name"),
    supabase.from("institutions").select("*").eq("household_id", ctx.household.id).order("name"),
  ]);

  return (
    <AccountsView
      householdId={ctx.household.id}
      owners={ctx.owners}
      accounts={(accounts.data ?? []) as Account[]}
      institutions={(institutions.data ?? []) as Institution[]}
    />
  );
}
