// Capital-market assumptions per allocation group (nominal annual figures).
// Used to auto-derive a blended expected return + volatility from the user's
// current asset mix for the Monte Carlo projection. These are illustrative
// long-run estimates, not forecasts.

export interface GroupAssumption {
  returnPct: number; // expected nominal annual return
  volPct: number; // annual volatility (standard deviation)
}

export const GROUP_ASSUMPTIONS: Record<string, GroupAssumption> = {
  "Cash & Equivalents": { returnPct: 2.5, volPct: 1 },
  "Public Equities": { returnPct: 7, volPct: 16 },
  "Fixed Income": { returnPct: 4, volPct: 5 },
  "Real Estate": { returnPct: 5, volPct: 12 },
  "Private & Alternatives": { returnPct: 10, volPct: 20 },
  Crypto: { returnPct: 12, volPct: 60 },
  "Physical & Collectibles": { returnPct: 3, volPct: 15 },
  "Insurance & Annuities": { returnPct: 3, volPct: 4 },
  Other: { returnPct: 3, volPct: 8 },
};

const DEFAULT_ASSUMPTION: GroupAssumption = { returnPct: 5, volPct: 12 };

export interface BlendedAssumptions {
  expectedReturnPct: number;
  volatilityPct: number;
}

/**
 * Blend per-group assumptions weighted by each group's share of (positive)
 * assets. Portfolio volatility uses a simple zero-correlation model
 * (variance = sum of (weight * vol)^2), which rewards diversification.
 */
export function blendAssumptions(
  byGroup: { group: string; valueMinor: number }[],
): BlendedAssumptions {
  const positive = byGroup.filter((g) => g.valueMinor > 0);
  const total = positive.reduce((s, g) => s + g.valueMinor, 0);
  if (total <= 0) {
    return { expectedReturnPct: 6, volatilityPct: 12 };
  }

  let expectedReturn = 0;
  let variance = 0;
  for (const g of positive) {
    const w = g.valueMinor / total;
    const a = GROUP_ASSUMPTIONS[g.group] ?? DEFAULT_ASSUMPTION;
    expectedReturn += w * a.returnPct;
    variance += (w * a.volPct) ** 2;
  }

  return {
    expectedReturnPct: Math.round(expectedReturn * 10) / 10,
    volatilityPct: Math.round(Math.sqrt(variance) * 10) / 10,
  };
}
