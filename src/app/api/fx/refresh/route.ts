import { NextResponse } from "next/server";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currency";

// Pulls live rates from the free ECB-backed Frankfurter API (no key required)
// and upserts base(reporting) -> quote rows. Currencies not covered by the ECB
// feed are simply skipped (you can add them manually).
export async function POST() {
  const ctx = await getHouseholdContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const base = ctx.household.reporting_currency;
  const symbols = CURRENCIES.map((c) => c.code).filter((c) => c !== base);

  let rates: Record<string, number> = {};
  try {
    const url = `https://api.frankfurter.app/latest?from=${base}&to=${symbols.join(",")}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`FX provider returned ${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number> };
    rates = json.rates ?? {};
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch rates" },
      { status: 502 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = Object.entries(rates).map(([quote, rate]) => ({
    household_id: ctx.household.id,
    base_currency: base,
    quote_currency: quote,
    rate,
    as_of_date: today,
    source: "live",
  }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rates returned for this base currency" }, { status: 502 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("exchange_rates")
    .upsert(rows, { onConflict: "household_id,base_currency,quote_currency,as_of_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: rows.length });
}
