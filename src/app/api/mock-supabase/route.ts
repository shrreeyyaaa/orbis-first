// Demo-mode backend for the browser Supabase stand-in. Disabled when real
// Supabase credentials are configured.
import { NextResponse, type NextRequest } from "next/server";
import { MOCK_COOKIE, isMockMode, type MockQuery } from "@/lib/supabase/mock/query";
import { demoUser, getUserById, runQuery, runRpc, signIn, signUp } from "@/lib/supabase/mock/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(request: NextRequest) {
  if (!isMockMode()) {
    return NextResponse.json({ data: null, error: { message: "Demo mode is off" } }, { status: 404 });
  }
  const body = await request.json();
  const uid = request.cookies.get(MOCK_COOKIE)?.value ?? null;

  if (body.kind === "query") return NextResponse.json(runQuery(body.query as MockQuery));
  if (body.kind === "rpc") return NextResponse.json(runRpc(body.fn, body.args ?? {}, uid));

  if (body.kind === "auth") {
    switch (body.action) {
      case "getUser":
        return NextResponse.json({ data: { user: getUserById(uid) }, error: null });
      case "signUp":
      case "signIn": {
        const r = body.action === "signUp" ? signUp(body.email, body.password) : signIn(body.email, body.password);
        const res = NextResponse.json({ data: { user: r.data.user, session: r.data.user ? {} : null }, error: r.error });
        if (r.data.user) res.cookies.set(MOCK_COOKIE, r.data.user.id, COOKIE_OPTS);
        return res;
      }
      case "demo": {
        const user = demoUser();
        const res = NextResponse.json({ data: { user }, error: null });
        res.cookies.set(MOCK_COOKIE, user.id, COOKIE_OPTS);
        return res;
      }
      case "signOut": {
        const res = NextResponse.json({ data: null, error: null });
        res.cookies.delete(MOCK_COOKIE);
        return res;
      }
    }
  }
  return NextResponse.json({ data: null, error: { message: "Unknown request" } }, { status: 400 });
}
