"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, MoneyInput, CurrencySelect, EnumSelect } from "@/components/form-fields";
import { toMinor } from "@/lib/currency";
import {
  OWNER_KIND_LABELS,
  ACCOUNT_TYPE_LABELS,
  GOAL_TYPE_LABELS,
} from "@/lib/labels";
import type { AccountType, GoalType, OwnerKind } from "@/lib/types";
import {
  LineChart,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Users,
  Wallet,
  Target,
  Plus,
  PartyPopper,
} from "lucide-react";

const STEP_LABELS = ["Your office", "Family", "Accounts", "Goals", "Done"];

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0); // 0 = welcome, 1..5 = steps
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [defaultOwnerId, setDefaultOwnerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 1
  const [householdName, setHouseholdName] = useState("");
  const [selfName, setSelfName] = useState(defaultName);
  const [currency, setCurrency] = useState("USD");

  // running tallies for the finish screen
  const [memberCount, setMemberCount] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const [goalCount, setGoalCount] = useState(0);
  const [demoLoaded, setDemoLoaded] = useState(false);

  async function createHousehold() {
    setBusy(true);
    setError(null);
    if (householdId) {
      await supabase
        .from("households")
        .update({ name: householdName || "My Family Office", reporting_currency: currency })
        .eq("id", householdId);
      setBusy(false);
      setStep(2);
      return;
    }
    const { data, error } = await supabase.rpc("create_household_with_seed", {
      p_household_name: householdName || "My Family Office",
      p_user_display_name: selfName || "Me",
      p_self_owner_name: selfName || "Me",
      p_reporting_currency: currency,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const hid = data as string;
    setHouseholdId(hid);
    const { data: owner } = await supabase
      .from("owners")
      .select("id")
      .eq("household_id", hid)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    setDefaultOwnerId(owner?.id ?? null);
    setBusy(false);
    setStep(2);
  }

  function finish() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <LineChart className="h-6 w-6 text-gold" />
        <span className="font-serif text-xl font-semibold tracking-tight">Orbis</span>
      </div>

      {step > 0 && (
        <div className="mb-8 flex w-full max-w-xl items-center justify-between">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium ${
                      done
                        ? "border-gold bg-gold text-gold-foreground"
                        : active
                          ? "border-gold text-gold"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : n}
                  </div>
                  <span className={`hidden text-xs sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`mx-1 h-px flex-1 ${done ? "bg-gold" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="w-full max-w-xl rounded-xl border bg-card p-8 shadow-sm">
        {step === 0 && (
          <WelcomeStep onStart={() => setStep(1)} />
        )}

        {step === 1 && (
          <div className="space-y-5">
            <StepHeading
              title="Set up your family office"
              subtitle="The essentials. Everything rolls up into your reporting currency."
            />
            <Field label="Family / office name">
              <Input
                placeholder="The Smith Family"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            </Field>
            <Field label="Your name (first owner)">
              <Input
                placeholder="Jane Smith"
                value={selfName}
                onChange={(e) => setSelfName(e.target.value)}
              />
            </Field>
            <Field label="Reporting currency">
              <CurrencySelect value={currency} onChange={setCurrency} />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end pt-2">
              <Button onClick={createHousehold} disabled={busy || !selfName}>
                {busy ? "Creating…" : "Continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && householdId && (
          <MembersStep
            householdId={householdId}
            onAdded={() => setMemberCount((c) => c + 1)}
            addedCount={memberCount}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && householdId && (
          <AccountsStep
            householdId={householdId}
            ownerId={defaultOwnerId}
            addedCount={accountCount}
            demoLoaded={demoLoaded}
            onAdded={() => setAccountCount((c) => c + 1)}
            onDemo={async () => {
              setBusy(true);
              await supabase.rpc("seed_demo_household", { p_household_id: householdId });
              setDemoLoaded(true);
              setBusy(false);
              setStep(5);
            }}
            busy={busy}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && householdId && (
          <GoalStep
            householdId={householdId}
            ownerId={defaultOwnerId}
            currency={currency}
            addedCount={goalCount}
            onAdded={() => setGoalCount((c) => c + 1)}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}

        {step === 5 && (
          <FinishStep
            memberCount={memberCount}
            accountCount={accountCount}
            goalCount={goalCount}
            demoLoaded={demoLoaded}
            onFinish={finish}
          />
        )}
      </div>
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold">
        <Sparkles className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Welcome to Orbis
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          We&apos;ll set up your private wealth dashboard in a few quick steps &mdash;
          your family office, members and entities, accounts, and a first goal. You can
          skip anything and finish later.
        </p>
      </div>
      <Button size="lg" onClick={onStart}>
        Get started <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  skip = true,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  skip?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <div className="flex gap-2">
        {skip && (
          <Button variant="outline" onClick={onNext}>
            Skip
          </Button>
        )}
        <Button onClick={onNext}>
          {nextLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MembersStep({
  householdId,
  onAdded,
  addedCount,
  onBack,
  onNext,
}: {
  householdId: string;
  onAdded: () => void;
  addedCount: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OwnerKind>("individual");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name) return;
    setBusy(true);
    await supabase.from("owners").insert({ household_id: householdId, name, kind });
    setName("");
    setBusy(false);
    onAdded();
  }

  return (
    <div className="space-y-5">
      <StepHeading
        title="Add family & entities"
        subtitle="Spouse, children, trusts, LLCs — anyone or anything that owns wealth. Optional."
      />
      <div className="flex items-center gap-2 rounded-lg bg-accent/50 p-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        {addedCount === 0 ? "Your own profile is already created." : `${addedCount} added.`}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input placeholder="Name (e.g. Spouse, Family Trust)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="w-40">
          <EnumSelect value={kind} onChange={setKind} options={OWNER_KIND_LABELS} />
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={add} disabled={busy || !name}>
        <Plus className="h-4 w-4" /> Add owner
      </Button>
      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

function AccountsStep({
  householdId,
  ownerId,
  addedCount,
  demoLoaded,
  onAdded,
  onDemo,
  busy,
  onBack,
  onNext,
}: {
  householdId: string;
  ownerId: string | null;
  addedCount: number;
  demoLoaded: boolean;
  onAdded: () => void;
  onDemo: () => void;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name || !ownerId) return;
    setSaving(true);
    await supabase.from("accounts").insert({
      household_id: householdId,
      owner_id: ownerId,
      name,
      type,
      currency,
      cash_balance_minor: Number(toMinor(balance || "0", currency)),
    });
    setName("");
    setBalance("");
    setSaving(false);
    onAdded();
  }

  return (
    <div className="space-y-5">
      <StepHeading
        title="Add your first account"
        subtitle="A bank, brokerage, or retirement account — or load sample data to explore."
      />
      <button
        type="button"
        onClick={onDemo}
        disabled={busy}
        className="flex w-full items-center gap-3 rounded-lg border border-gold/40 bg-gold/5 p-3 text-left transition-colors hover:bg-gold/10 disabled:opacity-60"
      >
        <Sparkles className="h-5 w-5 text-gold" />
        <div>
          <p className="text-sm font-medium">{busy ? "Loading sample data…" : "Load a sample portfolio"}</p>
          <p className="text-xs text-muted-foreground">
            A realistic multi-currency family office to explore. Skips to the end.
          </p>
        </div>
      </button>

      <div className="relative text-center">
        <span className="bg-card px-2 text-xs text-muted-foreground">or add one manually</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-accent/50 p-2 text-sm text-muted-foreground">
        <Wallet className="h-4 w-4" />
        {addedCount === 0 ? "No accounts yet." : `${addedCount} account(s) added.`}
      </div>
      <Field label="Account name">
        <Input placeholder="Chase Checking" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <EnumSelect value={type} onChange={setType} options={ACCOUNT_TYPE_LABELS} />
        </Field>
        <MoneyInput label="Balance" amount={balance} currency={currency} onAmount={setBalance} onCurrency={setCurrency} />
      </div>
      <Button variant="outline" className="w-full" onClick={add} disabled={saving || !name}>
        <Plus className="h-4 w-4" /> Add account
      </Button>
      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

function GoalStep({
  householdId,
  ownerId,
  currency,
  addedCount,
  onAdded,
  onBack,
  onNext,
}: {
  householdId: string;
  ownerId: string | null;
  currency: string;
  addedCount: number;
  onAdded: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<GoalType>("emergency");
  const [cur, setCur] = useState(currency);
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name) return;
    setSaving(true);
    await supabase.from("goals").insert({
      household_id: householdId,
      owner_id: ownerId,
      name,
      type,
      currency: cur,
      target_minor: Number(toMinor(target || "0", cur)),
    });
    setName("");
    setTarget("");
    setSaving(false);
    onAdded();
  }

  return (
    <div className="space-y-5">
      <StepHeading
        title="Set a first goal"
        subtitle="An emergency fund, a child's education, retirement — track progress over time. Optional."
      />
      <div className="flex items-center gap-2 rounded-lg bg-accent/50 p-2 text-sm text-muted-foreground">
        <Target className="h-4 w-4" />
        {addedCount === 0 ? "No goals yet." : `${addedCount} goal(s) added.`}
      </div>
      <Field label="Goal name">
        <Input placeholder="Emergency fund" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <EnumSelect value={type} onChange={setType} options={GOAL_TYPE_LABELS} />
        </Field>
        <MoneyInput label="Target" amount={target} currency={cur} onAmount={setTarget} onCurrency={setCur} />
      </div>
      <Button variant="outline" className="w-full" onClick={add} disabled={saving || !name}>
        <Plus className="h-4 w-4" /> Add goal
      </Button>
      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </div>
  );
}

function FinishStep({
  memberCount,
  accountCount,
  goalCount,
  demoLoaded,
  onFinish,
}: {
  memberCount: number;
  accountCount: number;
  goalCount: number;
  demoLoaded: boolean;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
        <PartyPopper className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">You&apos;re all set</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {demoLoaded
            ? "Your sample portfolio is ready to explore."
            : `Created your family office${memberCount ? `, ${memberCount} owner(s)` : ""}${
                accountCount ? `, ${accountCount} account(s)` : ""
              }${goalCount ? `, ${goalCount} goal(s)` : ""}. You can add more anytime from the dashboard checklist.`}
        </p>
      </div>
      <Button size="lg" onClick={onFinish}>
        Go to my dashboard <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
