import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { CashflowView } from "./cashflow-view";
import type { Expense, IncomeSource } from "@/lib/types";

export default async function CashflowPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const [income, expenses] = await Promise.all([
    supabase.from("income_sources").select("*").eq("household_id", ctx.household.id).order("created_at"),
    supabase.from("expenses").select("*").eq("household_id", ctx.household.id).order("spent_on", { ascending: false }),
  ]);

  return (
    <CashflowView
      householdId={ctx.household.id}
      owners={ctx.owners}
      incomeSources={(income.data ?? []) as IncomeSource[]}
      expenses={(expenses.data ?? []) as Expense[]}
    />
  );
}
