import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio, loadValuations } from "@/lib/load";
import { InsightsView } from "./insights-view";
import type { Expense, Goal, IncomeSource } from "@/lib/types";

export default async function InsightsPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const [portfolio, valuations, income, expenses, goals] = await Promise.all([
    loadPortfolio(ctx.household.id),
    loadValuations(ctx.household.id),
    supabase.from("income_sources").select("*").eq("household_id", ctx.household.id),
    supabase.from("expenses").select("*").eq("household_id", ctx.household.id),
    supabase.from("goals").select("*").eq("household_id", ctx.household.id),
  ]);

  return (
    <InsightsView
      owners={ctx.owners}
      portfolio={portfolio}
      valuations={valuations}
      incomeSources={(income.data ?? []) as IncomeSource[]}
      expenses={(expenses.data ?? []) as Expense[]}
      goals={(goals.data ?? []) as Goal[]}
    />
  );
}
