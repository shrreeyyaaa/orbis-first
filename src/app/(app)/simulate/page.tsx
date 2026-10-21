import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { loadPortfolio } from "@/lib/load";
import { SimulateView } from "./simulate-view";

export default async function SimulatePage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");
  const portfolio = await loadPortfolio(ctx.household.id);
  return <SimulateView owners={ctx.owners} portfolio={portfolio} />;
}
