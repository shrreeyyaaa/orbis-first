// Transparent 0-100 Financial Health Score. Every dimension is shown to the
// user with its own sub-score so there is no "black box".

export interface HealthInput {
  netWorthMinor: number;
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  liquidMinor: number; // cash & equivalents in reporting currency
  annualIncomeMinor: number;
  annualExpensesMinor: number;
  assetGroupCount: number; // distinct asset-class groups with positive value
  goalFundingAvg: number | null; // 0..1 average across goals, or null if none
  daysSinceUpdate: number | null;
}

export interface Dimension {
  key: string;
  label: string;
  /** 0..1 */
  score: number;
  weight: number;
  detail: string;
  tip: string;
}

export type Tier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface HealthResult {
  score: number; // 0..100
  tier: Tier;
  dimensions: Dimension[];
  topTip: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function tierFor(score: number): Tier {
  if (score >= 85) return "Platinum";
  if (score >= 65) return "Gold";
  if (score >= 40) return "Silver";
  return "Bronze";
}

export function computeHealthScore(input: HealthInput): HealthResult {
  const monthlyExpenses = input.annualExpensesMinor / 12;
  const coverageMonths =
    monthlyExpenses > 0 ? input.liquidMinor / monthlyExpenses : input.liquidMinor > 0 ? 6 : 0;
  const liquidity = clamp01(coverageMonths / 6);

  const diversification = clamp01((input.assetGroupCount - 1) / 5);

  const debtRatio =
    input.totalAssetsMinor > 0 ? input.totalLiabilitiesMinor / input.totalAssetsMinor : 1;
  const solvency = input.totalAssetsMinor <= 0 ? 0 : clamp01(1 - debtRatio / 0.6);

  const savingsRate =
    input.annualIncomeMinor > 0
      ? (input.annualIncomeMinor - input.annualExpensesMinor) / input.annualIncomeMinor
      : 0;
  const savings = clamp01(savingsRate / 0.3);

  const goals = input.goalFundingAvg == null ? 0.3 : clamp01(input.goalFundingAvg);

  let freshness: number;
  if (input.daysSinceUpdate == null) freshness = 0.5;
  else if (input.daysSinceUpdate <= 30) freshness = 1;
  else if (input.daysSinceUpdate <= 90) freshness = 0.6;
  else if (input.daysSinceUpdate <= 180) freshness = 0.3;
  else freshness = 0.1;

  const dimensions: Dimension[] = [
    {
      key: "liquidity",
      label: "Emergency liquidity",
      score: liquidity,
      weight: 20,
      detail: `${coverageMonths.toFixed(1)} months of expenses in cash`,
      tip: "Build cash reserves toward ~6 months of expenses.",
    },
    {
      key: "diversification",
      label: "Diversification",
      score: diversification,
      weight: 20,
      detail: `${input.assetGroupCount} asset classes`,
      tip: "Spread wealth across more asset classes to reduce concentration.",
    },
    {
      key: "solvency",
      label: "Solvency",
      score: solvency,
      weight: 20,
      detail: `${Math.round(debtRatio * 100)}% debt-to-assets`,
      tip: "Pay down high debt relative to assets to strengthen your balance sheet.",
    },
    {
      key: "savings",
      label: "Savings rate",
      score: savings,
      weight: 15,
      detail: input.annualIncomeMinor > 0 ? `${Math.round(savingsRate * 100)}% of income saved` : "No income recorded",
      tip: "Aim to save 20-30% of income; add income streams and trim expenses.",
    },
    {
      key: "goals",
      label: "Goal funding",
      score: goals,
      weight: 15,
      detail: input.goalFundingAvg == null ? "No goals set" : `${Math.round((input.goalFundingAvg ?? 0) * 100)}% funded`,
      tip: input.goalFundingAvg == null ? "Set goals like an emergency or education fund." : "Keep contributing toward your goals.",
    },
    {
      key: "freshness",
      label: "Data freshness",
      score: freshness,
      weight: 10,
      detail:
        input.daysSinceUpdate == null
          ? "No updates yet"
          : `Updated ${input.daysSinceUpdate}d ago`,
      tip: "Refresh your account and asset values to keep the picture accurate.",
    },
  ];

  const score = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
  );

  // Biggest opportunity = lowest-scoring dimension weighted by its potential gain.
  const topTip = [...dimensions]
    .sort((a, b) => (1 - a.score) * a.weight - (1 - b.score) * b.weight)
    .reverse()[0]?.tip;

  return { score, tier: tierFor(score), dimensions, topTip: topTip ?? "" };
}
