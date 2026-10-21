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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, MoneyInput, OwnerSelect, EnumSelect } from "@/components/form-fields";
import { GOAL_TYPE_LABELS } from "@/lib/labels";
import { toMinor, fromMinor } from "@/lib/currency";
import { toBase } from "@/lib/fx";
import type { Goal, GoalType, Owner } from "@/lib/types";
import { Target, Plus, Pencil, Trash2 } from "lucide-react";

export function GoalsView({
  householdId,
  owners,
  goals,
}: {
  householdId: string;
  owners: Owner[];
  goals: Goal[];
}) {
  const router = useRouter();
  const { includesOwner } = useScope();
  const { show, reportingCurrency, rates } = useCurrency();
  const ownerName = useMemo(() => new Map(owners.map((o) => [o.id, o.name])), [owners]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  useNewParam(() => {
    setEditing(null);
    setOpen(true);
  });

  const visible = goals.filter((g) => g.owner_id == null || includesOwner(g.owner_id));

  function monthsUntil(date: string | null): number | null {
    if (!date) return null;
    const diff = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.4);
    return Math.max(0, Math.round(diff));
  }

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Education funds, emergency reserves, retirement, major purchases, and philanthropy."
        action={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add goal
          </Button>
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set targets like a kids' 529 education fund, a 6-month emergency fund, or a retirement number, and track progress."
          action={
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Add your first goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((g) => {
            const saved = toBase(g.manual_saved_minor, g.currency, reportingCurrency, rates);
            const target = toBase(g.target_minor, g.currency, reportingCurrency, rates);
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            const remaining = Math.max(0, target - saved);
            const months = monthsUntil(g.target_date);
            const monthlyNeeded = months && months > 0 ? Math.round(remaining / months) : null;
            return (
              <Card key={g.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {GOAL_TYPE_LABELS[g.type]}
                        {g.owner_id ? ` · ${ownerName.get(g.owner_id)}` : " · Whole family"}
                        {g.target_date ? ` · by ${g.target_date}` : ""}
                      </p>
                    </div>
                    <Badge variant={pct >= 100 ? "success" : "secondary"}>{pct}%</Badge>
                  </div>
                  <Progress
                    value={pct}
                    className="mt-3"
                    indicatorClassName={pct >= 100 ? "bg-success" : undefined}
                  />
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="tabular-nums">{show(saved)}</span>
                    <span className="tabular-nums text-muted-foreground">{show(target)}</span>
                  </div>
                  {monthlyNeeded != null && pct < 100 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Save {show(monthlyNeeded)}/mo for {months} months to reach this.
                    </p>
                  )}
                  <div className="mt-3 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(g); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete ${g.name}?`)) return;
                        await createClient().from("goals").delete().eq("id", g.id);
                        toast({ title: "Goal deleted" });
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
      )}

      <GoalDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        householdId={householdId}
        owners={owners}
        goal={editing}
        onSaved={() => {
          setOpen(false);
          toast({ title: editing ? "Goal updated" : "Goal added", variant: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  householdId,
  owners,
  goal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  owners: Owner[];
  goal: Goal | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [type, setType] = useState<GoalType>(goal?.type ?? "education");
  const [ownerId, setOwnerId] = useState(goal?.owner_id ?? "none");
  const [currency, setCurrency] = useState(goal?.currency ?? "USD");
  const [target, setTarget] = useState(goal ? fromMinor(goal.target_minor, goal.currency) : "");
  const [saved, setSaved] = useState(goal ? fromMinor(goal.manual_saved_minor, goal.currency) : "");
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      household_id: householdId,
      owner_id: ownerId === "none" ? null : ownerId,
      name,
      type,
      currency,
      target_minor: Number(toMinor(target || "0", currency)),
      manual_saved_minor: Number(toMinor(saved || "0", currency)),
      target_date: targetDate || null,
    };
    const supabase = createClient();
    const { error } = goal
      ? await supabase.from("goals").update(payload).eq("id", goal.id)
      : await supabase.from("goals").insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Add goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Goal name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emma's college fund" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <EnumSelect value={type} onChange={setType} options={GOAL_TYPE_LABELS} />
            </Field>
            <Field label="For">
              <OwnerSelect owners={owners} value={ownerId} onChange={setOwnerId} allowNone />
            </Field>
          </div>
          <MoneyInput label="Target amount" amount={target} currency={currency} onAmount={setTarget} onCurrency={setCurrency} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Saved so far">
              <Input inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} />
            </Field>
            <Field label="Target date">
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </Field>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
