import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { MOCK_COOKIE, isMockMode } from "./mock/query";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  if (isMockMode()) {
    // Demo mode: no Supabase project configured, use the local stand-in.
    const { createServerMockClient } = await import("./mock/server-client");
    const uid = cookieStore.get(MOCK_COOKIE)?.value ?? null;
    return createServerMockClient(uid) as unknown as ReturnType<typeof createServerClient>;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies; middleware refreshes the session.
          }
        },
      },
    },
  );
}
