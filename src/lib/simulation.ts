// Deterministic what-if projection + future-FX math. All amounts are in
// reporting-currency minor units unless stated otherwise.

export interface ProjectionLine {
  valueMinor: number; // signed (liabilities negative)
  growthPct: number; // annual %, can be negative
}

export interface ProjectionInput {
  lines: ProjectionLine[];
  years: number;
  inflationPct: number;
  monthlyContributionMinor: number;
  contributionReturnPct: number;
}

export interface ProjectionPoint {
  year: number;
  nominalMinor: number;
  realMinor: number;
}

/** Future value of a series of monthly contributions compounding monthly. */
function contributionsFV(monthly: number, years: number, annualReturnPct: number): number {
  const months = Math.round(years * 12);
  const r = annualReturnPct / 100 / 12;
  if (months <= 0) return 0;
  if (Math.abs(r) < 1e-9) return monthly * months;
  return Math.round(monthly * ((Math.pow(1 + r, months) - 1) / r));
}

export function projectNetWorth(input: ProjectionInput): ProjectionPoint[] {
  const { lines, years, inflationPct, monthlyContributionMinor, contributionReturnPct } = input;
  const out: ProjectionPoint[] = [];
  for (let t = 0; t <= years; t++) {
    let nominal = 0;
    for (const l of lines) {
      nominal += l.valueMinor * Math.pow(1 + l.growthPct / 100, t);
    }
    nominal += contributionsFV(monthlyContributionMinor, t, contributionReturnPct);
    const real = nominal / Math.pow(1 + inflationPct / 100, t);
    out.push({ year: t, nominalMinor: Math.round(nominal), realMinor: Math.round(real) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Future FX / currency what-if
// Rates are expressed as: units of `quote` per 1 unit of `base`.
// ---------------------------------------------------------------------------

/** Forward rate implied by a constant annual drift. */
export function forwardFromDrift(spot: number, annualDriftPct: number, years: number): number {
  return spot * Math.pow(1 + annualDriftPct / 100, years);
}

/**
 * Covered interest-rate-parity forward rate.
 * F = S * ((1 + i_quote) / (1 + i_base))^years
 */
export function forwardFromIRP(
  spot: number,
  baseRatePct: number,
  quoteRatePct: number,
  years: number,
): number {
  return spot * Math.pow((1 + quoteRatePct / 100) / (1 + baseRatePct / 100), years);
}

/**
 * Purchasing-power break-even rate: the future rate that exactly preserves
 * today's value once each currency's inflation is accounted for. Above this,
 * converting in the future gets you more than you'd need; below it, less.
 * R_be = S * (1 + infl_base)^years / (1 + infl_quote)^years
 */
export function breakEvenRate(
  spot: number,
  baseInflationPct: number,
  quoteInflationPct: number,
  years: number,
): number {
  return (
    spot *
    (Math.pow(1 + baseInflationPct / 100, years) /
      Math.pow(1 + quoteInflationPct / 100, years))
  );
}

/** Sensitivity points: convert `amountBaseMinor` at a range of future rates. */
export function fxSensitivity(
  amountBaseMinor: number,
  spot: number,
  lowFactor = 0.7,
  highFactor = 1.3,
  steps = 13,
): { rate: number; quoteMinor: number; deltaVsSpot: number }[] {
  const out: { rate: number; quoteMinor: number; deltaVsSpot: number }[] = [];
  const atSpot = amountBaseMinor * spot;
  for (let i = 0; i < steps; i++) {
    const rate = spot * (lowFactor + ((highFactor - lowFactor) * i) / (steps - 1));
    const quoteMinor = amountBaseMinor * rate;
    out.push({
      rate,
      quoteMinor: Math.round(quoteMinor),
      deltaVsSpot: Math.round(quoteMinor - atSpot),
    });
  }
  return out;
}
