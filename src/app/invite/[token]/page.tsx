import { createClient } from "@/lib/supabase/server";
import { InviteAccept } from "./invite-accept";
import type { MemberRole } from "@/lib/types";

interface InviteDetail {
  household_name: string | null;
  role: MemberRole | null;
  status: "valid" | "expired" | "accepted" | "invalid";
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("invite_details", { p_token: token });
  const detail = (Array.isArray(data) ? data[0] : data) as InviteDetail | undefined;

  return (
    <InviteAccept
      token={token}
      isLoggedIn={!!user}
      householdName={detail?.household_name ?? null}
      role={detail?.role ?? null}
      status={detail?.status ?? "invalid"}
    />
  );
}
