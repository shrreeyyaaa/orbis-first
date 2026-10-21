import type { Portfolio } from "@/lib/load";

/** Filter a portfolio to the owners in scope (null = all owners). */
export function filterPortfolio(p: Portfolio, ownerIds: string[] | null): Portfolio {
  if (ownerIds === null) return p;
  const set = new Set(ownerIds);
  const accounts = p.accounts.filter((a) => set.has(a.owner_id));
  const accountIds = new Set(accounts.map((a) => a.id));
  const holdings = p.holdings.filter((h) => accountIds.has(h.account_id));
  const assets = p.assets.filter((a) => set.has(a.owner_id));
  const liabilities = p.liabilities.filter((l) => set.has(l.owner_id));
  const holdableIds = new Set<string>([
    ...accounts.map((a) => a.id),
    ...holdings.map((h) => h.id),
    ...assets.map((a) => a.id),
    ...liabilities.map((l) => l.id),
  ]);
  const ownership = p.ownership.filter((o) => holdableIds.has(o.holdable_id));
  return { accounts, holdings, assets, liabilities, ownership };
}
