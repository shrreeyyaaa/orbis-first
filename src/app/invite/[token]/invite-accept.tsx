"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import type { MemberRole } from "@/lib/types";
import { Check } from "lucide-react";

export function InviteAccept({
  token,
  isLoggedIn,
  householdName,
  role,
  status,
}: {
  token: string;
  isLoggedIn: boolean;
  householdName: string | null;
  role: MemberRole | null;
  status: "valid" | "expired" | "accepted" | "invalid";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = encodeURIComponent(`/invite/${token}`);

  async function accept() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("accept_invite", { p_token: token });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (status !== "valid") {
    const msg =
      status === "accepted"
        ? "This invite has already been used."
        : status === "expired"
          ? "This invite has expired. Ask an admin to send a new one."
          : "This invite link is invalid.";
    return (
      <AuthShell title="Invitation" subtitle={msg}>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  const title = householdName ? `Join ${householdName}` : "Join household";
  const subtitle = `You've been invited as a ${role ?? "member"}.`;

  if (!isLoggedIn) {
    return (
      <AuthShell title={title} subtitle={`${subtitle} Sign in or create an account to accept.`}>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href={`/login?next=${next}`}>Sign in</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/signup?next=${next}`}>Create an account</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={title} subtitle={subtitle}>
      <div className="space-y-4">
        <Button className="w-full" onClick={accept} disabled={busy}>
          <Check className="h-4 w-4" />
          {busy ? "Joining…" : `Accept invitation`}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          Joining adds this household to your account.
        </p>
      </div>
    </AuthShell>
  );
}
