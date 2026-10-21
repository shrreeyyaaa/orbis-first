import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";
import type { ExchangeRate } from "@/lib/types";
import type { InviteRow, MemberRow } from "@/components/members-invites";

export default async function SettingsPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const [rates, members, invites] = await Promise.all([
    supabase
      .from("exchange_rates")
      .select("*")
      .eq("household_id", ctx.household.id)
      .order("as_of_date", { ascending: false }),
    supabase
      .from("household_members")
      .select("user_id, display_name, role")
      .eq("household_id", ctx.household.id),
    // RLS only returns invites to admins; members get an empty list.
    supabase
      .from("household_invites")
      .select("id, email, role, token, expires_at, accepted_at")
      .eq("household_id", ctx.household.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <SettingsView
      household={ctx.household}
      member={ctx.member}
      rates={(rates.data ?? []) as ExchangeRate[]}
      members={(members.data ?? []) as MemberRow[]}
      invites={(invites.data ?? []) as InviteRow[]}
    />
  );
}
