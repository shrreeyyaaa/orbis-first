"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrency } from "@/components/currency-context";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, CurrencySelect } from "@/components/form-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currency";
import { MembersInvites, type MemberRow, type InviteRow } from "@/components/members-invites";
import type { ExchangeRate, Household, HouseholdMember } from "@/lib/types";
import { RefreshCw, Plus, Trash2 } from "lucide-react";

export function SettingsView({
  household,
  member,
  rates,
  members,
  invites,
}: {
  household: Household;
  member: HouseholdMember;
  rates: ExchangeRate[];
  members: MemberRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const { setDisplayCurrency } = useCurrency();

  const [reporting, setReporting] = useState(household.reporting_currency);
  const [savingReporting, setSavingReporting] = useState(false);

  const [base, setBase] = useState("USD");
  const [quote, setQuote] = useState(household.reporting_currency);
  const [rateVal, setRateVal] = useState("");
  const [addingRate, setAddingRate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveReporting() {
    setSavingReporting(true);
    await createClient().from("households").update({ reporting_currency: reporting }).eq("id", household.id);
    setSavingReporting(false);
    router.refresh();
  }

  async function addRate() {
    if (!rateVal) return;
    setAddingRate(true);
    setMsg(null);
    const { error } = await createClient().from("exchange_rates").insert({
      household_id: household.id,
      base_currency: base,
      quote_currency: quote,
      rate: Number(rateVal),
      as_of_date: new Date().toISOString().slice(0, 10),
      source: "manual",
    });
    setAddingRate(false);
    if (error) { setMsg(error.message); return; }
    setRateVal("");
    router.refresh();
  }

  async function refreshLive() {
    setRefreshing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/fx/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setMsg(`Updated ${json.count} rates from live source.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to refresh rates");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Currencies, exchange rates, and preferences." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reporting currency</CardTitle>
          <CardDescription>
            Everything across the app rolls up into this currency for net worth.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="w-64">
            <CurrencySelect value={reporting} onChange={setReporting} />
          </div>
          <Button onClick={saveReporting} disabled={savingReporting || reporting === household.reporting_currency}>
            {savingReporting ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your display currency</CardTitle>
          <CardDescription>
            View totals in a different currency than the reporting currency (only affects you).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-64">
            <Select
              value={member.display_currency ?? household.reporting_currency}
              onValueChange={async (v) => {
                setDisplayCurrency(v);
                await createClient()
                  .from("household_members")
                  .update({ display_currency: v })
                  .eq("household_id", household.id)
                  .eq("user_id", member.user_id);
                router.refresh();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Exchange rates</CardTitle>
            <CardDescription>
              Used to convert all currencies into your reporting currency.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={refreshLive} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Fetching…" : "Fetch live rates"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
            <Field label="From">
              <RateCcy value={base} onChange={setBase} />
            </Field>
            <Field label="To">
              <RateCcy value={quote} onChange={setQuote} />
            </Field>
            <Field label="Rate">
              <Input
                className="w-32"
                inputMode="decimal"
                placeholder="1.08"
                value={rateVal}
                onChange={(e) => setRateVal(e.target.value)}
              />
            </Field>
            <Button onClick={addRate} disabled={addingRate || !rateVal}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {msg && <p className="mb-3 text-sm text-muted-foreground">{msg}</p>}

          {rates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No rates yet. Add manually or fetch live rates. Items in a currency
              without a rate are counted 1:1.
            </p>
          ) : (
            <div className="divide-y">
              {rates.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="font-medium">
                    1 {r.base_currency} = {r.rate} {r.quote_currency}
                  </span>
                  <Badge variant="outline">{r.source}</Badge>
                  <span className="text-xs text-muted-foreground">{r.as_of_date}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={async () => {
                      await createClient().from("exchange_rates").delete().eq("id", r.id);
                      router.refresh();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <MembersInvites
          householdId={household.id}
          currentUserId={member.user_id}
          isAdmin={member.role === "admin"}
          members={members}
          invites={invites}
        />
      </div>
    </div>
  );
}

function RateCcy({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
