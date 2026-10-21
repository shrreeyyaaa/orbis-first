import { createClient } from "@/lib/supabase/server";
import type { Household, HouseholdMember, Owner } from "@/lib/types";

export interface HouseholdContext {
  household: Household;
  member: HouseholdMember;
  owners: Owner[];
  userId: string;
  userEmail: string;
}

/**
 * Loads the signed-in user's household, their membership row, and the list of
 * owners. Returns null when the user has not completed onboarding yet.
 */
export async function getHouseholdContext(): Promise<HouseholdContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("household_members")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  const { data: household } = await supabase
    .from("households")
    .select("*")
    .eq("id", member.household_id)
    .single();

  if (!household) return null;

  const { data: owners } = await supabase
    .from("owners")
    .select("*")
    .eq("household_id", household.id)
    .order("is_default", { ascending: false })
    .order("name");

  return {
    household: household as Household,
    member: member as HouseholdMember,
    owners: (owners ?? []) as Owner[],
    userId: user.id,
    userEmail: user.email ?? "",
  };
}
