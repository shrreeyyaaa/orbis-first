"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, EnumSelect } from "@/components/form-fields";
import type { MemberRole } from "@/lib/types";
import { Trash2, Copy, Check, UserPlus, ShieldCheck, User } from "lucide-react";

export interface MemberRow {
  user_id: string;
  display_name: string | null;
  role: MemberRole;
}

export interface InviteRow {
  id: string;
  email: string;
  role: MemberRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
}

const ROLE_LABELS: Record<MemberRole, string> = { admin: "Admin", member: "Member" };

export function MembersInvites({
  householdId,
  currentUserId,
  isAdmin,
  members,
  invites,
}: {
  householdId: string;
  currentUserId: string;
  isAdmin: boolean;
  members: MemberRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const pending = invites.filter((i) => !i.accepted_at);

  async function createInvite() {
    if (!email) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().from("household_invites").insert({
      household_id: householdId,
      email,
      role,
      created_by: currentUserId,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function revoke(id: string) {
    await createClient().from("household_invites").delete().eq("id", id);
    router.refresh();
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members &amp; access</CardTitle>
        <CardDescription>
          People who can sign in to this family office.{" "}
          {isAdmin ? "Invite family members or advisors below." : "Only admins can manage invites."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
              <div className="rounded-md bg-accent p-1.5">
                {m.role === "admin" ? <ShieldCheck className="h-4 w-4 text-gold" /> : <User className="h-4 w-4 text-muted-foreground" />}
              </div>
              <span className="flex-1 truncate">
                {m.display_name || "Member"}
                {m.user_id === currentUserId && <span className="text-muted-foreground"> (you)</span>}
              </span>
              <Badge variant={m.role === "admin" ? "default" : "secondary"}>{ROLE_LABELS[m.role]}</Badge>
            </div>
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
              <Field label="Invite by email">
                <Input
                  type="email"
                  placeholder="person@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-56"
                />
              </Field>
              <Field label="Role">
                <div className="w-32">
                  <EnumSelect value={role} onChange={setRole} options={ROLE_LABELS} />
                </div>
              </Field>
              <Button onClick={createInvite} disabled={busy || !email}>
                <UserPlus className="h-4 w-4" /> Create invite
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}

            {pending.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pending invites
                </p>
                {pending.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                    <Badge variant="outline">{ROLE_LABELS[inv.role]}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => copyLink(inv.token)}>
                      {copied === inv.token ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      {copied === inv.token ? "Copied" : "Copy link"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => revoke(inv.id)} title="Revoke">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
