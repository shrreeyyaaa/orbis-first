import { getMinorDigits } from "@/lib/currency";

export type InsightSeverity = "critical" | "warn" | "info" | "positive";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  category: string;
  href?: string;
  actionLabel?: string;
}

export interface InsightGoal {
  name: string;
  type: string;
  savedMinor: number;
  targetMinor: number;
  monthlyMinor: number;
  targetDate: string | null;
}

export interface InsightLiability {
  name: string;
  ratePct: number | null;
  balanceMinor: number;
}

export interface InsightsInput {
  reportingCurrency: string;
  netWorthMinor: number;
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  liquidMinor: number; // cash & equivalents, reporting currency
  annualIncomeMinor: number;
  annualExpensesMinor: number;
  assetGroupCount: number;
  /** positive-value holdings/assets in reporting currency, for concentration. */
  items: { name: string; baseMinor: number; group: string }[];
  goals: InsightGoal[];
  liabilities: InsightLiability[];
  /** names of trusts/LLCs/etc. with no beneficiaries recorded. */
  trustsMissingBeneficiaries: string[];
  missingRates: boolean;
  daysSinceUpdate: number | null;
  /** formats a reporting-currency minor amount. */
  fmt: (minor: number) => string;
}

export const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  warn: 1,
  info: 2,
  positive: 3,
};

const MILESTONES = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 100_000_000];

export function computeInsights(input: InsightsInput): Insight[] {
  const out: Insight[] = [];
  const { fmt } = input;
  const assets = input.totalAssetsMinor;
  const monthlyExpenses = input.annualExpensesMinor / 12;

  // 1. Emergency fund coverage
  if (input.annualExpensesMinor > 0) {
    const months = input.liquidMinor / monthlyExpenses;
    if (months < 1) {
      out.push({
        id: "emergency-critical",
        severity: "critical",
        category: "Liquidity",
        title: "Emergency fund is very low",
        detail: `Your cash covers about ${months.toFixed(1)} months of expenses. Aim for 3-6 months.`,
        href: "/goals",
        actionLabel: "Set an emergency goal",
      });
    } else if (months < 3) {
      out.push({
        id: "emergency-warn",
        severity: "warn",
        category: "Liquidity",
        title: "Build up your emergency fund",
        detail: `You have about ${months.toFixed(1)} months of expenses in cash. A 3-6 month buffer is healthier.`,
        href: "/goals",
        actionLabel: "Review goals",
      });
    } else if (months >= 6) {
      out.push({
        id: "emergency-positive",
        severity: "positive",
        category: "Liquidity",
        title: "Emergency fund looks solid",
        detail: `You hold roughly ${Math.round(months)} months of expenses in cash.`,
      });
    }
  }

  // 2. Cash drag
  if (assets > 0) {
    const cashPct = input.liquidMinor / assets;
    if (cashPct > 0.25 && input.liquidMinor > 0) {
      out.push({
        id: "cash-drag",
        severity: "info",
        category: "Investing",
        title: "High cash allocation",
        detail: `About ${Math.round(cashPct * 100)}% of assets sit in cash (${fmt(input.liquidMinor)}). Idle cash can lag inflation.`,
        href: "/investments",
        actionLabel: "Review investments",
      });
    }
  }

  // 3. Concentration risk
  if (assets > 0 && input.items.length > 0) {
    const largest = [...input.items].sort((a, b) => b.baseMinor - a.baseMinor)[0];
    const pct = largest.baseMinor / assets;
    if (pct > 0.2) {
      out.push({
        id: "concentration",
        severity: pct > 0.4 ? "warn" : "info",
        category: "Risk",
        title: "Concentrated position",
        detail: `${largest.name} is ${Math.round(pct * 100)}% of your assets. Concentration raises risk.`,
        href: "/net-worth",
        actionLabel: "View breakdown",
      });
    }
  }

  // 4. Diversification
  if (assets > 0 && input.assetGroupCount > 0 && input.assetGroupCount <= 2) {
    out.push({
      id: "diversification",
      severity: "info",
      category: "Risk",
      title: "Limited diversification",
      detail: `Your wealth spans only ${input.assetGroupCount} asset class${input.assetGroupCount === 1 ? "" : "es"}. Spreading across more can reduce risk.`,
      href: "/net-worth",
    });
  }

  // 5. Savings rate
  if (input.annualIncomeMinor > 0) {
    const rate = (input.annualIncomeMinor - input.annualExpensesMinor) / input.annualIncomeMinor;
    if (rate < 0) {
      out.push({
        id: "savings-negative",
        severity: "critical",
        category: "Cash flow",
        title: "Spending exceeds income",
        detail: `Your tracked expenses are higher than income by ${fmt(input.annualExpensesMinor - input.annualIncomeMinor)}/year.`,
        href: "/cashflow",
        actionLabel: "Review cash flow",
      });
    } else if (rate < 0.1) {
      out.push({
        id: "savings-low",
        severity: "warn",
        category: "Cash flow",
        title: "Low savings rate",
        detail: `You're saving about ${Math.round(rate * 100)}% of income. Many target 20%+.`,
        href: "/cashflow",
      });
    } else if (rate >= 0.2) {
      out.push({
        id: "savings-strong",
        severity: "positive",
        category: "Cash flow",
        title: "Strong savings rate",
        detail: `You're saving roughly ${Math.round(rate * 100)}% of income. Keep it up.`,
      });
    }
  }

  // 6. Debt-to-assets
  if (assets > 0) {
    const ratio = input.totalLiabilitiesMinor / assets;
    if (ratio > 0.5) {
      out.push({
        id: "leverage",
        severity: "warn",
        category: "Liabilities",
        title: "High leverage",
        detail: `Liabilities are ${Math.round(ratio * 100)}% of assets. Reducing debt strengthens your balance sheet.`,
        href: "/liabilities",
      });
    }
  }

  // 7. Goals off-track / funded
  for (const g of input.goals) {
    if (g.targetMinor <= 0) continue;
    if (g.savedMinor >= g.targetMinor) {
      out.push({
        id: `goal-done-${g.name}`,
        severity: "positive",
        category: "Goals",
        title: `${g.name} is fully funded`,
        detail: `You've reached your ${fmt(g.targetMinor)} target.`,
      });
      continue;
    }
    if (g.targetDate) {
      const months = Math.max(
        0,
        (new Date(g.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.4),
      );
      if (months > 0) {
        const needed = (g.targetMinor - g.savedMinor) / months;
        if (needed > g.monthlyMinor * 1.1) {
          out.push({
            id: `goal-behind-${g.name}`,
            severity: "warn",
            category: "Goals",
            title: `${g.name} is behind schedule`,
            detail: `Reaching it on time needs about ${fmt(Math.round(needed))}/month${g.monthlyMinor > 0 ? ` (currently ${fmt(g.monthlyMinor)})` : ""}.`,
            href: "/goals",
          });
        }
      }
    }
  }

  // 8. Missing FX rates
  if (input.missingRates) {
    out.push({
      id: "missing-fx",
      severity: "warn",
      category: "Data quality",
      title: "Missing exchange rates",
      detail: "Some holdings use a currency without a rate and are counted 1:1, so totals may be off.",
      href: "/settings",
      actionLabel: "Add rates",
    });
  }

  // 9. Stale data
  if (input.daysSinceUpdate != null && input.daysSinceUpdate > 120) {
    out.push({
      id: "stale",
      severity: "info",
      category: "Data quality",
      title: "Values may be out of date",
      detail: `Nothing has been updated in about ${input.daysSinceUpdate} days. Refresh balances for an accurate picture.`,
    });
  }

  // 10. High-rate liabilities
  const highRate = input.liabilities
    .filter((l) => (l.ratePct ?? 0) >= 8)
    .sort((a, b) => (b.ratePct ?? 0) - (a.ratePct ?? 0))[0];
  if (highRate) {
    out.push({
      id: "high-rate-debt",
      severity: "info",
      category: "Liabilities",
      title: "High-interest debt",
      detail: `${highRate.name} carries a ${highRate.ratePct}% rate (${fmt(highRate.balanceMinor)}). Prioritizing paydown saves interest.`,
      href: "/liabilities",
    });
  }

  // 11. Estate hygiene
  for (const name of input.trustsMissingBeneficiaries.slice(0, 2)) {
    out.push({
      id: `beneficiaries-${name}`,
      severity: "info",
      category: "Estate",
      title: `${name} has no beneficiaries recorded`,
      detail: "Recording beneficiaries keeps your estate details organized.",
      href: "/family",
    });
  }

  // 12. Milestone proximity
  const digits = getMinorDigits(input.reportingCurrency);
  const nwMajor = input.netWorthMinor / 10 ** digits;
  const next = MILESTONES.find((m) => m > nwMajor);
  if (next && nwMajor > 0 && (next - nwMajor) / next < 0.1) {
    out.push({
      id: "milestone",
      severity: "positive",
      category: "Milestone",
      title: "A milestone is within reach",
      detail: `You're about ${fmt(Math.round((next - nwMajor) * 10 ** digits))} away from ${fmt(next * 10 ** digits)} net worth.`,
    });
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
