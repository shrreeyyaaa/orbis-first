"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useScope } from "@/components/scope-context";
import { useNewParam } from "@/lib/use-new-param";
import { toast } from "@/components/ui/use-toast";
import { useCurrency } from "@/components/currency-context";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, MoneyInput, OwnerSelect, EnumSelect } from "@/components/form-fields";
import {
  INCOME_TYPE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  CADENCE_LABELS,
  annualize,
} from "@/lib/labels";
import { toMinor, fromMinor } from "@/lib/currency";
import { toBase } from "@/lib/fx";
import type {
  Cadence,
  Expense,
  ExpenseCategory,
  IncomeSource,
  IncomeType,
  Owner,
} from "@/lib/types";
import { Plus, Pencil, Trash2, ArrowDownUp } from "lucide-react";

export function CashflowView({
  householdId,
  owners,
  incomeSources,
  expenses,
}: {
  householdId: string;
  owners: Owner[];
  incomeSources: IncomeSource[];
  expenses: Expense[];
}) {
  const router = useRouter();
  const { includesOwner } = useScope();
  const { show, reportingCurrency, rates } = useCurrency();
  const ownerName = useMemo(() => new Map(owners.map((o) => [o.id, o.name])), [owners]);

  const [incomeOpen, setIncomeOpen] = useState(false);
  const [editIncome, setEditIncome] = useState<IncomeSource | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  useNewParam(() => {
    setEditIncome(null);
    setIncomeOpen(true);
  });

  const visIncome = incomeSources.filter((s) => includesOwner(s.owner_id));
  const visExpenses = expenses.filter((e) => includesOwner(e.owner_id));

  const annualIncome = visIncome
    .filter((s) => s.is_active)
    .reduce(
      (sum, s) => sum + toBase(annualize(s.expected_amount_minor, s.cadence), s.currency, reportingCurrency, rates),
      0,
    );
  const annualExpenses = visExpenses.reduce((sum, e) => {
    const amt = e.is_recurring && e.cadence ? annualize(e.amount_minor, e.cadence) : e.amount_minor;
    return sum + toBase(amt, e.currency, reportingCurrency, rates);
  }, 0);

  return (
    <div>
      <PageHeader
        title="Cash Flow"
        description="Income streams and expenses, annualized into your reporting currency."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Annual income" value={show(annualIncome)} accent="positive" />
        <StatCard label="Annual expenses" value={show(annualExpenses)} accent="negative" />
        <StatCard
          label="Net annual surplus"
          value={show(annualIncome - annualExpenses)}
          accent={annualIncome - annualExpenses >= 0 ? "positive" : "negative"}
          sub={`${show(Math.round((annualIncome - annualExpenses) / 12))} / month`}
        />
      </div>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Income ({visIncome.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({visExpenses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="income">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => { setEditIncome(null); setIncomeOpen(true); }} disabled={owners.length === 0}>
              <Plus className="h-4 w-4" /> Add income stream
            </Button>
          </div>
          {visIncome.length === 0 ? (
            <Empty label="No income streams yet. Add salary, business income, dividends, rent, interest, trust distributions, and more." />
          ) : (
            <div className="space-y-2">
              {visIncome.map((s) => (
                <Row
                  key={s.id}
                  title={s.name}
                  subtitle={`${INCOME_TYPE_LABELS[s.type]} · ${ownerName.get(s.owner_id)} · ${CADENCE_LABELS[s.cadence]}`}
                  amount={show(toBase(s.expected_amount_minor, s.currency, reportingCurrency, rates))}
                  amountSub={`${show(toBase(annualize(s.expected_amount_minor, s.cadence), s.currency, reportingCurrency, rates))}/yr`}
                  positive
                  inactive={!s.is_active}
                  onEdit={() => { setEditIncome(s); setIncomeOpen(true); }}
                  onDelete={async () => {
                    if (!confirm(`Delete ${s.name}?`)) return;
                    await createClient().from("income_sources").delete().eq("id", s.id);
                    toast({ title: "Income stream deleted" });
                    router.refresh();
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expenses">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => { setEditExpense(null); setExpenseOpen(true); }} disabled={owners.length === 0}>
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          </div>
          {visExpenses.length === 0 ? (
            <Empty label="No expenses yet. Track mortgage and loan EMIs, day-to-day spending, tuition, insurance, taxes, and giving." />
          ) : (
            <div className="space-y-2">
              {visExpenses.map((e) => (
                <Row
                  key={e.id}
                  title={e.description}
                  subtitle={`${EXPENSE_CATEGORY_LABELS[e.category]} · ${ownerName.get(e.owner_id)}${
                    e.is_recurring && e.cadence ? ` · ${CADENCE_LABELS[e.cadence]}` : ` · ${e.spent_on}`
                  }`}
                  amount={show(toBase(e.amount_minor, e.currency, reportingCurrency, rates))}
                  amountSub={
                    e.is_recurring && e.cadence
                      ? `${show(toBase(annualize(e.amount_minor, e.cadence), e.currency, reportingCurrency, rates))}/yr`
                      : undefined
                  }
                  onEdit={() => { setEditExpense(e); setExpenseOpen(true); }}
                  onDelete={async () => {
                    if (!confirm(`Delete ${e.description}?`)) return;
                    await createClient().from("expenses").delete().eq("id", e.id);
                    toast({ title: "Expense deleted" });
                    router.refresh();
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <IncomeDialog
        key={editIncome?.id ?? "newinc"}
        open={incomeOpen}
        onOpenChange={setIncomeOpen}
        householdId={householdId}
        owners={owners}
        source={editIncome}
        onSaved={() => {
          setIncomeOpen(false);
          toast({ title: editIncome ? "Income stream updated" : "Income stream added", variant: "success" });
          router.refresh();
        }}
      />
      <ExpenseDialog
        key={editExpense?.id ?? "newexp"}
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        householdId={householdId}
        owners={owners}
        expense={editExpense}
        onSaved={() => {
          setExpenseOpen(false);
          toast({ title: editExpense ? "Expense updated" : "Expense added", variant: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
      <ArrowDownUp className="mb-3 h-8 w-8 text-muted-foreground/50" />
      <p className="max-w-md text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  title,
  subtitle,
  amount,
  amountSub,
  positive,
  inactive,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  amount: string;
  amountSub?: string;
  positive?: boolean;
  inactive?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{title}</p>
            {inactive && <Badge variant="secondary">Inactive</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold tabular-nums ${positive ? "text-success" : ""}`}>{amount}</p>
          {amountSub && <p className="text-xs text-muted-foreground">{amountSub}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function IncomeDialog({
  open,
  onOpenChange,
  householdId,
  owners,
  source,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  owners: Owner[];
  source: IncomeSource | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(source?.name ?? "");
  const [ownerId, setOwnerId] = useState(source?.owner_id ?? owners[0]?.id ?? "");
  const [type, setType] = useState<IncomeType>(source?.type ?? "salary");
  const [currency, setCurrency] = useState(source?.currency ?? "USD");
  const [amount, setAmount] = useState(source ? fromMinor(source.expected_amount_minor, source.currency) : "");
  const [cadence, setCadence] = useState<Cadence>(source?.cadence ?? "monthly");
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
      expected_amount_minor: Number(toMinor(amount || "0", currency)),
      cadence,
      is_active: true,
    };
    const supabase = createClient();
    const { error } = source
      ? await supabase.from("income_sources").update(payload).eq("id", source.id)
      : await supabase.from("income_sources").insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{source ? "Edit income stream" : "Add income stream"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp salary, Rental – 5th Ave…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <OwnerSelect owners={owners} value={ownerId} onChange={setOwnerId} />
            </Field>
            <Field label="Type">
              <EnumSelect value={type} onChange={setType} options={INCOME_TYPE_LABELS} />
            </Field>
          </div>
          <MoneyInput label="Amount" amount={amount} currency={currency} onAmount={setAmount} onCurrency={setCurrency} />
          <Field label="Frequency">
            <EnumSelect value={cadence} onChange={setCadence} options={CADENCE_LABELS} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name || !ownerId}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  householdId,
  owners,
  expense,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  owners: Owner[];
  expense: Expense | null;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(expense?.description ?? "");
  const [ownerId, setOwnerId] = useState(expense?.owner_id ?? owners[0]?.id ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "other");
  const [currency, setCurrency] = useState(expense?.currency ?? "USD");
  const [amount, setAmount] = useState(expense ? fromMinor(expense.amount_minor, expense.currency) : "");
  const [recurring, setRecurring] = useState(expense?.is_recurring ?? true);
  const [cadence, setCadence] = useState<Cadence>(expense?.cadence ?? "monthly");
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      household_id: householdId,
      owner_id: ownerId,
      description,
      category,
      currency,
      amount_minor: Number(toMinor(amount || "0", currency)),
      is_recurring: recurring,
      cadence: recurring ? cadence : null,
      spent_on: spentOn,
    };
    const supabase = createClient();
    const { error } = expense
      ? await supabase.from("expenses").update(payload).eq("id", expense.id)
      : await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mortgage payment, tuition…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <OwnerSelect owners={owners} value={ownerId} onChange={setOwnerId} />
            </Field>
            <Field label="Category">
              <EnumSelect value={category} onChange={setCategory} options={EXPENSE_CATEGORY_LABELS} />
            </Field>
          </div>
          <MoneyInput label="Amount" amount={amount} currency={currency} onAmount={setAmount} onCurrency={setCurrency} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Recurring?">
              <EnumSelect
                value={recurring ? "yes" : "no"}
                onChange={(v) => setRecurring(v === "yes")}
                options={{ yes: "Recurring", no: "One-time" }}
              />
            </Field>
            {recurring ? (
              <Field label="Frequency">
                <EnumSelect value={cadence} onChange={setCadence} options={CADENCE_LABELS} />
              </Field>
            ) : (
              <Field label="Date">
                <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
              </Field>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !description || !ownerId}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
