import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { FamilyView } from "./family-view";

export default async function FamilyPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");
  return <FamilyView householdId={ctx.household.id} owners={ctx.owners} />;
}
