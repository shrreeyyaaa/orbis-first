"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useScope } from "@/components/scope-context";
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
import { useNewParam } from "@/lib/use-new-param";
import { toast } from "@/components/ui/use-toast";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { toMinor, fromMinor } from "@/lib/currency";
import { toBase } from "@/lib/fx";
import type { Account, AccountType, Institution, Owner } from "@/lib/types";
import { Wallet, Plus, Pencil, Trash2 } from "lucide-react";

export function AccountsView({
  householdId,
  owners,
  accounts,
  institutions,
}: {
  householdId: string;
  owners: Owner[];
  accounts: Account[];
  institutions: Institution[];
}) {
  const router = useRouter();
  const { includesOwner } = useScope();
  const { show, reportingCurrency, rates } = useCurrency();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  useNewParam(() => {
    setEditing(null);
    setOpen(true);
  });

  const visible = accounts.filter((a) => includesOwner(a.owner_id));
  const ownerName = useMemo(
    () => new Map(owners.map((o) => [o.id, o.name])),
    [owners],
  );

  const total = visible.reduce(
    (s, a) => s + toBase(a.cash_balance_minor, a.currency, reportingCurrency, rates),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Bank, cash, and investment accounts. Cash balances shown here; holdings live under Investments."
        action={
          owners.length > 0 ? (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add account
            </Button>
          ) : null
        }
      />

      {owners.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Add an owner first"
          description="Accounts belong to a family member or entity. Add one under Family."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add checking, savings, brokerage, retirement (401k, IRA, Roth), 529, HSA, and more."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add account
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Total cash balance:{" "}
            <span className="font-semibold text-foreground">{show(total)}</span>
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[a.type]} · {ownerName.get(a.owner_id)}
                      </p>
                    </div>
                    <Badge variant="outline">{a.currency}</Badge>
                  </div>
                  <p className="mt-3 text-xl font-semibold tabular-nums">
                    {show(toBase(a.cash_balance_minor, a.currency, reportingCurrency, rates))}
                  </p>
                  <div className="mt-3 flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete ${a.name}?`)) return;
                        await createClient().from("accounts").delete().eq("id", a.id);
                        toast({ title: "Account deleted" });
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

      <AccountDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        householdId={householdId}
        owners={owners}
        institutions={institutions}
        account={editing}
        onSaved={() => {
          setOpen(false);
          toast({ title: editing ? "Account updated" : "Account added", variant: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

function AccountDialog({
  open,
  onOpenChange,
  householdId,
  owners,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  owners: Owner[];
  institutions: Institution[];
  account: Account | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [ownerId, setOwnerId] = useState(account?.owner_id ?? owners[0]?.id ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [currency, setCurrency] = useState(account?.currency ?? "USD");
  const [balance, setBalance] = useState(
    account ? fromMinor(account.cash_balance_minor, account.currency) : "",
  );
  const [rate, setRate] = useState(account?.interest_rate_pct?.toString() ?? "");
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
      cash_balance_minor: Number(toMinor(balance || "0", currency)),
      interest_rate_pct: rate ? Number(rate) : null,
    };
    const supabase = createClient();
    const { error } = account
      ? await supabase.from("accounts").update(payload).eq("id", account.id)
      : await supabase.from("accounts").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Account name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chase Checking" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <OwnerSelect owners={owners} value={ownerId} onChange={setOwnerId} />
            </Field>
            <Field label="Type">
              <EnumSelect value={type} onChange={setType} options={ACCOUNT_TYPE_LABELS} />
            </Field>
          </div>
          <MoneyInput
            label="Cash balance"
            amount={balance}
            currency={currency}
            onAmount={setBalance}
            onCurrency={setCurrency}
            hint="For brokerage/retirement accounts, this is the uninvested cash. Add positions under Investments."
          />
          <Field label="Interest rate % (optional)">
            <Input
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 4.5"
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name || !ownerId}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
