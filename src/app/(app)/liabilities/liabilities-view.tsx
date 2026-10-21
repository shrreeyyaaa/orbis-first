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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, MoneyInput, OwnerSelect, EnumSelect } from "@/components/form-fields";
import { LIABILITY_TYPE_LABELS } from "@/lib/labels";
import { toMinor, fromMinor } from "@/lib/currency";
import { toBase } from "@/lib/fx";
import type { Liability, LiabilityType, Owner } from "@/lib/types";
import { CreditCard, Plus, Pencil, Trash2 } from "lucide-react";

export function LiabilitiesView({
  householdId,
  owners,
  liabilities,
}: {
  householdId: string;
  owners: Owner[];
  liabilities: Liability[];
}) {
  const router = useRouter();
  const { includesOwner } = useScope();
  const { show, reportingCurrency, rates } = useCurrency();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Liability | null>(null);
  useNewParam(() => {
    setEditing(null);
    setOpen(true);
  });

  const visible = liabilities.filter((l) => includesOwner(l.owner_id));
  const ownerName = useMemo(() => new Map(owners.map((o) => [o.id, o.name])), [owners]);
  const total = visible.reduce(
    (s, l) => s + toBase(l.balance_minor, l.currency, reportingCurrency, rates),
    0,
  );
  const monthly = visible.reduce(
    (s, l) => s + toBase(l.monthly_payment_minor ?? 0, l.currency, reportingCurrency, rates),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Liabilities"
        description="Mortgages, loans, credit lines, and cards across the family."
        action={
          owners.length > 0 ? (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Add liability
            </Button>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No liabilities"
          description="Track mortgages, HELOCs, auto/personal loans, margin & securities-backed lines, and credit cards."
          action={
            owners.length > 0 ? (
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="h-4 w-4" /> Add liability
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">Add an owner under Family first.</span>
            )
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Total owed: <span className="font-semibold text-destructive">{show(total)}</span>
            {monthly > 0 && (
              <> · Monthly payments: <span className="font-semibold text-foreground">{show(monthly)}</span></>
            )}
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((l) => (
              <Card key={l.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {LIABILITY_TYPE_LABELS[l.type]} · {ownerName.get(l.owner_id)}
                      </p>
                    </div>
                    {l.interest_rate_pct != null && (
                      <Badge variant="outline">{l.interest_rate_pct}%</Badge>
                    )}
                  </div>
                  <p className="mt-3 text-xl font-semibold tabular-nums text-destructive">
                    {show(toBase(l.balance_minor, l.currency, reportingCurrency, rates))}
                  </p>
                  {l.monthly_payment_minor != null && l.monthly_payment_minor > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {show(toBase(l.monthly_payment_minor, l.currency, reportingCurrency, rates))} / mo
                    </p>
                  )}
                  <div className="mt-3 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(l); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete ${l.name}?`)) return;
                        await createClient().from("liabilities").delete().eq("id", l.id);
                        toast({ title: "Liability deleted" });
                        router.refresh();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <LiabilityDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        householdId={householdId}
        owners={owners}
        liability={editing}
        onSaved={() => {
          setOpen(false);
          toast({ title: editing ? "Liability updated" : "Liability added", variant: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

function LiabilityDialog({
  open,
  onOpenChange,
  householdId,
  owners,
  liability,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  owners: Owner[];
  liability: Liability | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(liability?.name ?? "");
  const [ownerId, setOwnerId] = useState(liability?.owner_id ?? owners[0]?.id ?? "");
  const [type, setType] = useState<LiabilityType>(liability?.type ?? "mortgage");
  const [currency, setCurrency] = useState(liability?.currency ?? "USD");
  const [balance, setBalance] = useState(liability ? fromMinor(liability.balance_minor, liability.currency) : "");
  const [payment, setPayment] = useState(
    liability?.monthly_payment_minor != null ? fromMinor(liability.monthly_payment_minor, liability.currency) : "",
  );
  const [rate, setRate] = useState(liability?.interest_rate_pct?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      household_id: householdId,
      owner_id: ownerId,
      name,
      type,
      currency,
      balance_minor: Number(toMinor(balance || "0", currency)),
      monthly_payment_minor: payment ? Number(toMinor(payment, currency)) : null,
      interest_rate_pct: rate ? Number(rate) : null,
    };
    const supabase = createClient();
    const { error } = liability
      ? await supabase.from("liabilities").update(payload).eq("id", liability.id)
      : await supabase.from("liabilities").insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{liability ? "Edit liability" : "Add liability"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Primary home mortgage" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <OwnerSelect owners={owners} value={ownerId} onChange={setOwnerId} />
            </Field>
            <Field label="Type">
              <EnumSelect value={type} onChange={setType} options={LIABILITY_TYPE_LABELS} />
            </Field>
          </div>
          <MoneyInput
            label="Outstanding balance"
            amount={balance}
            currency={currency}
            onAmount={setBalance}
            onCurrency={setCurrency}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly payment (EMI)">
              <Input inputMode="decimal" value={payment} onChange={(e) => setPayment(e.target.value)} />
            </Field>
            <Field label="Interest rate %">
              <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 6.5" />
            </Field>
          </div>
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
