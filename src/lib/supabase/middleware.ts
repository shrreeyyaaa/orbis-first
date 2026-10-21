import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MOCK_COOKIE, isMockMode } from "./mock/query";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/invite", "/api/mock-supabase"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let user: unknown = null;

  if (isMockMode()) {
    // Demo mode: the session is just a cookie holding the demo user's id.
    user = request.cookies.get(MOCK_COOKIE)?.value ?? null;
  } else {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      // Fail with a readable message instead of an opaque middleware crash.
      return new NextResponse(
        "Orbis is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
          "in your hosting environment variables, then redeploy.",
        { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // (Skipped in demo mode: the cookie may point at a user that no longer
  // exists, and bouncing away from /login would then loop.)
  if (user && !isMockMode() && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
