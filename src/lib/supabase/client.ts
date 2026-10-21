import { createBrowserClient } from "@supabase/ssr";
import { isMockMode } from "./mock/query";
import { createBrowserMockClient } from "./mock/browser-client";

export function createClient() {
  if (isMockMode()) {
    // Demo mode: no Supabase project configured, use the local stand-in.
    return createBrowserMockClient() as unknown as ReturnType<typeof createBrowserClient>;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
