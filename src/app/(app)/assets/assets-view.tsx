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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, MoneyInput, OwnerSelect, EnumSelect } from "@/components/form-fields";
import { ASSET_CLASS_LABELS } from "@/lib/labels";
import { toMinor, fromMinor } from "@/lib/currency";
import { toBase } from "@/lib/fx";
import type { Asset, AssetClass, Owner } from "@/lib/types";
import { Landmark, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";

// Asset classes that make sense as standalone holdings (exclude public securities).
const ASSET_CLASS_OPTIONS: Partial<Record<AssetClass, string>> = {
  real_estate: ASSET_CLASS_LABELS.real_estate,
  land: ASSET_CLASS_LABELS.land,
  vehicle: ASSET_CLASS_LABELS.vehicle,
  gold: ASSET_CLASS_LABELS.gold,
  precious_metal: ASSET_CLASS_LABELS.precious_metal,
  art: ASSET_CLASS_LABELS.art,
  collectible: ASSET_CLASS_LABELS.collectible,
  jewelry: ASSET_CLASS_LABELS.jewelry,
  private_equity: ASSET_CLASS_LABELS.private_equity,
  venture: ASSET_CLASS_LABELS.venture,
  business: ASSET_CLASS_LABELS.business,
  hedge_fund: ASSET_CLASS_LABELS.hedge_fund,
  crypto: ASSET_CLASS_LABELS.crypto,
  life_insurance: ASSET_CLASS_LABELS.life_insurance,
  annuity: ASSET_CLASS_LABELS.annuity,
  cash: ASSET_CLASS_LABELS.cash,
  other: ASSET_CLASS_LABELS.other,
};

export function AssetsView({
  householdId,
  owners,
  assets,
}: {
  householdId: string;
  owners: Owner[];
  assets: Asset[];
}) {
  const router = useRouter();
  const { includesOwner } = useScope();
  const { show, reportingCurrency, rates } = useCurrency();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  useNewParam(() => {
    setEditing(null);
    setOpen(true);
  });

  const visible = assets.filter((a) => includesOwner(a.owner_id));
  const ownerName = useMemo(() => new Map(owners.map((o) => [o.id, o.name])), [owners]);
  const total = visible.reduce(
    (s, a) => s + toBase(a.current_value_minor, a.currency, reportingCurrency, rates),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Assets"
        description="Real estate, land, gold, art, vehicles, private equity, venture, and business interests."
        action={
          owners.length > 0 ? (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Add asset
            </Button>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No assets yet"
          description="Track appreciating assets like property and art, and depreciating ones like vehicles."
          action={
            owners.length > 0 ? (
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="h-4 w-4" /> Add asset
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">Add an owner under Family first.</span>
            )
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Total asset value:{" "}
            <span className="font-semibold text-foreground">{show(total)}</span>
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => {
              const gain =
                a.purchase_value_minor != null
                  ? a.current_value_minor - a.purchase_value_minor
                  : null;
              return (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ASSET_CLASS_LABELS[a.class]} · {ownerName.get(a.owner_id)}
                        </p>
                      </div>
                      <Badge variant={a.is_appreciating ? "success" : "secondary"}>
                        {a.is_appreciating ? "Appreciating" : "Depreciating"}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xl font-semibold tabular-nums">
                      {show(toBase(a.current_value_minor, a.currency, reportingCurrency, rates))}
                    </p>
                    {gain != null && (
                      <p
                        className={`mt-1 flex items-center gap-1 text-xs ${
                          gain >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {gain >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {show(toBase(Math.abs(gain), a.currency, reportingCurrency, rates))} vs cost
                      </p>
                    )}
                    <div className="mt-3 flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm(`Delete ${a.name}?`)) return;
                          await createClient().from("assets").delete().eq("id", a.id);
                          toast({ title: "Asset deleted" });
                          router.refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AssetDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        householdId={householdId}
        owners={owners}
        asset={editing}
        onSaved={() => {
          setOpen(false);
          toast({ title: editing ? "Asset updated" : "Asset added", variant: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

function AssetDialog({
  open,
  onOpenChange,
  householdId,
  owners,
  asset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  owners: Owner[];
  asset: Asset | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(asset?.name ?? "");
  const [ownerId, setOwnerId] = useState(asset?.owner_id ?? owners[0]?.id ?? "");
  const [cls, setCls] = useState<AssetClass>(asset?.class ?? "real_estate");
  const [currency, setCurrency] = useState(asset?.currency ?? "USD");
  const [value, setValue] = useState(asset ? fromMinor(asset.current_value_minor, asset.currency) : "");
  const [purchase, setPurchase] = useState(
    asset?.purchase_value_minor != null ? fromMinor(asset.purchase_value_minor, asset.currency) : "",
  );
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchase_date ?? "");
  const [growth, setGrowth] = useState(asset?.annual_growth_pct?.toString() ?? "");
  const [appreciating, setAppreciating] = useState(asset?.is_appreciating ?? true);
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      household_id: householdId,
      owner_id: ownerId,
      name,
      class: cls,
      currency,
      current_value_minor: Number(toMinor(value || "0", currency)),
      purchase_value_minor: purchase ? Number(toMinor(purchase, currency)) : null,
      purchase_date: purchaseDate || null,
      annual_growth_pct: growth ? Number(growth) : null,
      is_appreciating: appreciating,
      notes: notes || null,
    };
    const supabase = createClient();
    const { error } = asset
      ? await supabase.from("assets").update(payload).eq("id", asset.id)
      : await supabase.from("assets").insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset ? "Edit asset" : "Add asset"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lake House, Picasso, Tesla…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <OwnerSelect owners={owners} value={ownerId} onChange={setOwnerId} />
            </Field>
            <Field label="Class">
              <EnumSelect
                value={cls}
                onChange={(v) => {
                  setCls(v);
                  setAppreciating(v !== "vehicle");
                }}
                options={ASSET_CLASS_OPTIONS as Record<string, string>}
              />
            </Field>
          </div>
          <MoneyInput
            label="Current value"
            amount={value}
            currency={currency}
            onAmount={setValue}
            onCurrency={setCurrency}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase price (optional)">
              <Input inputMode="decimal" value={purchase} onChange={(e) => setPurchase(e.target.value)} />
            </Field>
            <Field label="Purchase date">
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assumed annual growth %" hint="Used by simulations">
              <Input inputMode="decimal" value={growth} onChange={(e) => setGrowth(e.target.value)} placeholder="e.g. 4" />
            </Field>
            <Field label="Direction">
              <EnumSelect
                value={appreciating ? "up" : "down"}
                onChange={(v) => setAppreciating(v === "up")}
                options={{ up: "Appreciating", down: "Depreciating" }}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name || !ownerId}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
