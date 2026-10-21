// Achievement definitions tied to real financial actions/milestones. The UI
// maps `icon` strings to components so this stays framework-agnostic.

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: "setup" | "milestone" | "habit";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "foundation", title: "Foundation Laid", description: "Added your first account.", icon: "flag", category: "setup" },
  { key: "diversified", title: "Diversified", description: "Hold assets across 4+ asset classes.", icon: "layers", category: "milestone" },
  { key: "safety_net", title: "Safety Net", description: "Fully funded an emergency goal.", icon: "shield", category: "milestone" },
  { key: "estate_minded", title: "Estate Minded", description: "Added a trust or LLC.", icon: "landmark", category: "setup" },
  { key: "global_citizen", title: "Global Citizen", description: "Hold value in 2+ currencies.", icon: "globe", category: "milestone" },
  { key: "goal_setter", title: "Goal Setter", description: "Set 3 or more goals.", icon: "target", category: "setup" },
  { key: "in_the_black", title: "In the Black", description: "Positive annual net cash flow.", icon: "trending-up", category: "habit" },
  { key: "nw_1m", title: "Millionaire", description: "Net worth crossed 1M.", icon: "gem", category: "milestone" },
  { key: "nw_5m", title: "Five Comma", description: "Net worth crossed 5M.", icon: "gem", category: "milestone" },
  { key: "nw_10m", title: "Eight Figures", description: "Net worth crossed 10M.", icon: "medal", category: "milestone" },
  { key: "nw_25m", title: "Family Office", description: "Net worth crossed 25M.", icon: "award", category: "milestone" },
  { key: "nw_100m", title: "Nine Figures", description: "Net worth crossed 100M.", icon: "crown", category: "milestone" },
];

export const ACHIEVEMENTS_BY_KEY: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.key, a]),
);

export interface AchievementContext {
  accountCount: number;
  assetGroupCount: number;
  hasTrustOrLlc: boolean;
  currencyCount: number;
  goalCount: number;
  emergencyFunded: boolean;
  positiveCashFlow: boolean;
  /** net worth in reporting-currency MAJOR units (e.g. dollars) */
  netWorthMajor: number;
}

/** Returns the set of achievement keys currently earned given the context. */
export function evaluateAchievements(ctx: AchievementContext): string[] {
  const earned: string[] = [];
  if (ctx.accountCount > 0) earned.push("foundation");
  if (ctx.assetGroupCount >= 4) earned.push("diversified");
  if (ctx.emergencyFunded) earned.push("safety_net");
  if (ctx.hasTrustOrLlc) earned.push("estate_minded");
  if (ctx.currencyCount >= 2) earned.push("global_citizen");
  if (ctx.goalCount >= 3) earned.push("goal_setter");
  if (ctx.positiveCashFlow) earned.push("in_the_black");
  if (ctx.netWorthMajor >= 1_000_000) earned.push("nw_1m");
  if (ctx.netWorthMajor >= 5_000_000) earned.push("nw_5m");
  if (ctx.netWorthMajor >= 10_000_000) earned.push("nw_10m");
  if (ctx.netWorthMajor >= 25_000_000) earned.push("nw_25m");
  if (ctx.netWorthMajor >= 100_000_000) earned.push("nw_100m");
  return earned;
}
