import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { AssetsView } from "./assets-view";
import type { Asset } from "@/lib/types";

export default async function AssetsPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("household_id", ctx.household.id)
    .order("current_value_minor", { ascending: false });

  return (
    <AssetsView
      householdId={ctx.household.id}
      owners={ctx.owners}
      assets={(data ?? []) as Asset[]}
    />
  );
}
