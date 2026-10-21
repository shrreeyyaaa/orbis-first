// Monte Carlo net-worth projection. Each run steps year-by-year with a random
// annual return drawn from Normal(mean, sd). A seeded PRNG keeps results stable
// for identical inputs (no flicker between renders).

export interface MonteCarloInput {
  startMinor: number;
  years: number;
  runs: number;
  expectedReturnPct: number;
  volatilityPct: number;
  monthlyContributionMinor: number;
  inflationPct: number;
  targetMinor?: number | null;
  seed?: number;
}

export interface MonteCarloPoint {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface MonteCarloResult {
  points: MonteCarloPoint[];
  medianEnding: number;
  p10Ending: number;
  p90Ending: number;
  realMedianEnding: number;
  probAboveStart: number; // 0..1
  probAboveTarget: number | null;
}

/** Small, fast seeded PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller, drawing from the provided uniform RNG. */
function normal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const {
    startMinor,
    years,
    runs,
    expectedReturnPct,
    volatilityPct,
    monthlyContributionMinor,
    inflationPct,
    targetMinor,
    seed = 1337,
  } = input;

  const mean = expectedReturnPct / 100;
  const sd = Math.max(0, volatilityPct / 100);
  const annualContribution = monthlyContributionMinor * 12;
  const rng = mulberry32(seed);

  // balancesByYear[y] holds every run's balance at year y (y = 0..years)
  const balancesByYear: number[][] = Array.from({ length: years + 1 }, () => []);

  for (let r = 0; r < runs; r++) {
    let balance = startMinor;
    balancesByYear[0].push(balance);
    for (let y = 1; y <= years; y++) {
      const ret = mean + sd * normal(rng);
      balance = balance * (1 + ret) + annualContribution;
      balancesByYear[y].push(balance);
    }
  }

  const points: MonteCarloPoint[] = balancesByYear.map((arr, year) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      year,
      p10: percentile(sorted, 10),
      p25: percentile(sorted, 25),
      p50: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p90: percentile(sorted, 90),
    };
  });

  const endings = [...balancesByYear[years]].sort((a, b) => a - b);
  const medianEnding = percentile(endings, 50);
  const aboveStart = endings.filter((b) => b >= startMinor).length / endings.length;
  const aboveTarget =
    targetMinor != null && targetMinor > 0
      ? endings.filter((b) => b >= targetMinor).length / endings.length
      : null;
  const realMedianEnding = medianEnding / Math.pow(1 + inflationPct / 100, years);

  return {
    points,
    medianEnding,
    p10Ending: percentile(endings, 10),
    p90Ending: percentile(endings, 90),
    realMedianEnding,
    probAboveStart: aboveStart,
    probAboveTarget: aboveTarget,
  };
}
