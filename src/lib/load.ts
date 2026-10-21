import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  Asset,
  Holding,
  Liability,
  Valuation,
} from "@/lib/types";
import type { OwnershipRow } from "@/lib/networth";

export interface Portfolio {
  accounts: Account[];
  holdings: Holding[];
  assets: Asset[];
  liabilities: Liability[];
  ownership: OwnershipRow[];
}

export async function loadPortfolio(householdId: string): Promise<Portfolio> {
  const supabase = await createClient();
  const [accounts, holdings, assets, liabilities, ownership] = await Promise.all([
    supabase.from("accounts").select("*").eq("household_id", householdId),
    supabase.from("holdings").select("*").eq("household_id", householdId),
    supabase.from("assets").select("*").eq("household_id", householdId),
    supabase.from("liabilities").select("*").eq("household_id", householdId),
    supabase.from("ownership").select("holdable_type, holdable_id, owner_id, percent").eq("household_id", householdId),
  ]);
  return {
    accounts: (accounts.data ?? []) as Account[],
    holdings: (holdings.data ?? []) as Holding[],
    assets: (assets.data ?? []) as Asset[],
    liabilities: (liabilities.data ?? []) as Liability[],
    ownership: (ownership.data ?? []) as OwnershipRow[],
  };
}

export async function loadValuations(householdId: string): Promise<Valuation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("valuations")
    .select("*")
    .eq("household_id", householdId)
    .order("as_of_date", { ascending: true });
  return (data ?? []) as Valuation[];
}
