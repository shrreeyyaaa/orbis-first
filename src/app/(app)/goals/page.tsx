import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { GoalsView } from "./goals-view";
import type { Goal } from "@/lib/types";

export default async function GoalsPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("household_id", ctx.household.id)
    .order("priority")
    .order("target_date");

  return (
    <GoalsView householdId={ctx.household.id} owners={ctx.owners} goals={(data ?? []) as Goal[]} />
  );
}
