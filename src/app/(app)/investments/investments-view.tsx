"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useScope } from "@/components/scope-context";
import { useNewParam } from "@/lib/use-new-param";
import { toast } from "@/components/ui/use-toast";
import { useCurrency } from "@/components/currency-context";
import { PageHeader, EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, MoneyInput, EnumSelect } from "@/components/form-fields";
import { ASSET_CLASS_LABELS } from "@/lib/labels";
import { toMinor, fromMinor } from "@/lib/currency";
import { toBase } from "@/lib/fx";
import type { Account, Asset, AssetClass, Holding, Owner } from "@/lib/types";
import { TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";

const SECURITY_CLASSES: Partial<Record<AssetClass, string>> = {
  equity: ASSET_CLASS_LABELS.equity,
  etf: ASSET_CLASS_LABELS.etf,
  mutual_fund: ASSET_CLASS_LABELS.mutual_fund,
  bond: ASSET_CLASS_LABELS.bond,
  crypto: ASSET_CLASS_LABELS.crypto,
  other: ASSET_CLASS_LABELS.other,
};

const PRIVATE_CLASSES: AssetClass[] = [
  "private_equity",
  "venture",
  "business",
  "hedge_fund",
];

export function InvestmentsView({
  householdId,
  owners,
  accounts,
  holdings,
  assets,
}: {
  householdId: string;
  owners: Owner[];
  accounts: Account[];
  holdings: Holding[];
  assets: Asset[];
}) {
  const router = useRouter();
  const { includesOwner } = useScope();
  const { show, reportingCurrency, rates } = useCurrency();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  useNewParam(() => {
    setEditing(null);
    setOpen(true);
  });

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const investAccounts = accounts.filter((a) =>
    ["brokerage", "ira", "roth_ira", "401k", "403b", "hsa", "529", "pension", "trust_account", "crypto"].includes(a.type),
  );

  const visibleHoldings = holdings.filter((h) => {
    const acc = accountById.get(h.account_id);
    return acc && includesOwner(acc.owner_id);
  });

  const privateAssets = assets.filter(
    (a) => PRIVATE_CLASSES.includes(a.class) && includesOwner(a.owner_id),
  );

  const holdingValue = (h: Holding) =>
    toBase(Math.round(h.quantity * h.unit_price_minor), h.currency, reportingCurrency, rates);

  const publicTotal = visibleHoldings.reduce((s, h) => s + holdingValue(h), 0);
  const privateTotal = privateAssets.reduce(
    (s, a) => s + toBase(a.current_value_minor, a.currency, reportingCurrency, rates),
    0,
  );

  // group holdings by account
  const byAccount = useMemo(() => {
    const m = new Map<string, Holding[]>();
    for (const h of visibleHoldings) {
      if (!m.has(h.account_id)) m.set(h.account_id, []);
      m.get(h.account_id)!.push(h);
    }
    return m;
  }, [visibleHoldings]);

  return (
    <div>
      <PageHeader
        title="Investments"
        description="Public-market positions inside your accounts, plus private equity, venture, and business interests."
        action={
          investAccounts.length > 0 ? (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Add holding
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Public markets</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{show(publicTotal)}</p>
            <p className="text-xs text-muted-foreground">{visibleHoldings.length} positions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Private & alternatives</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{show(privateTotal)}</p>
            <p className="text-xs text-muted-foreground">
              {privateAssets.length} holdings · managed under Assets
            </p>
          </CardContent>
        </Card>
      </div>

      {investAccounts.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No investment accounts yet"
          description="Create a brokerage, IRA, Roth, 401(k), 529, or HSA account first, then add holdings."
        />
      ) : byAccount.size === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No holdings yet"
          description="Add stocks, ETFs, mutual funds, bonds, or crypto positions to your investment accounts."
          action={
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Add holding
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {[...byAccount.entries()].map(([accId, hs]) => {
            const acc = accountById.get(accId)!;
            const accTotal = hs.reduce((s, h) => s + holdingValue(h), 0);
            return (
              <Card key={accId}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{acc.name}</CardTitle>
                  <span className="text-sm font-semibold tabular-nums">{show(accTotal)}</span>
                </CardHeader>
                <CardContent className="space-y-1">
                  {hs.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{h.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.quantity} @ {fromMinor(h.unit_price_minor, h.currency)} {h.currency}
                          {" · "}
                          <Badge variant="outline" className="ml-1">{ASSET_CLASS_LABELS[h.class]}</Badge>
                        </p>
                      </div>
                      <span className="text-sm tabular-nums">{show(holdingValue(h))}</span>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(h); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm(`Delete ${h.name}?`)) return;
                          await createClient().from("holdings").delete().eq("id", h.id);
                          toast({ title: "Holding deleted" });
                          router.refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <HoldingDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        householdId={householdId}
        accounts={investAccounts}
        owners={owners}
        holding={editing}
        onSaved={() => {
          setOpen(false);
          toast({ title: editing ? "Holding updated" : "Holding added", variant: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

function HoldingDialog({
  open,
  onOpenChange,
  householdId,
  accounts,
  holding,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  accounts: Account[];
  owners: Owner[];
  holding: Holding | null;
  onSaved: () => void;
}) {
  const [accountId, setAccountId] = useState(holding?.account_id ?? accounts[0]?.id ?? "");
  const [name, setName] = useState(holding?.name ?? "");
  const [cls, setCls] = useState<AssetClass>(holding?.class ?? "equity");
  const [currency, setCurrency] = useState(holding?.currency ?? "USD");
  const [quantity, setQuantity] = useState(holding?.quantity?.toString() ?? "");
  const [price, setPrice] = useState(holding ? fromMinor(holding.unit_price_minor, holding.currency) : "");
  const [cost, setCost] = useState(
    holding?.cost_basis_minor != null ? fromMinor(holding.cost_basis_minor, holding.currency) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      household_id: householdId,
      account_id: accountId,
      name,
      class: cls,
      currency,
      quantity: Number(quantity || "0"),
      unit_price_minor: Number(toMinor(price || "0", currency)),
      cost_basis_minor: cost ? Number(toMinor(cost, currency)) : null,
    };
    const supabase = createClient();
    const { error } = holding
      ? await supabase.from("holdings").update(payload).eq("id", holding.id)
      : await supabase.from("holdings").insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{holding ? "Edit holding" : "Add holding"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Account">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name / ticker">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="AAPL, VTI…" />
            </Field>
            <Field label="Class">
              <EnumSelect value={cls} onChange={setCls} options={SECURITY_CLASSES as Record<string, string>} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
            <MoneyInput
              label="Price / unit"
              amount={price}
              currency={currency}
              onAmount={setPrice}
              onCurrency={setCurrency}
            />
          </div>
          <Field label="Total cost basis (optional)">
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name || !accountId}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
