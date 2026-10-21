import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { LiabilitiesView } from "./liabilities-view";
import type { Liability } from "@/lib/types";

export default async function LiabilitiesPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("liabilities")
    .select("*")
    .eq("household_id", ctx.household.id)
    .order("balance_minor", { ascending: false });

  return (
    <LiabilitiesView
      householdId={ctx.household.id}
      owners={ctx.owners}
      liabilities={(data ?? []) as Liability[]}
    />
  );
}
