// Browser-side dummy client: forwards every call to /api/mock-supabase.
import { createMockClient, type MockAuth, type MockResult } from "./query";

async function call(body: unknown): Promise<MockResult> {
  try {
    const res = await fetch("/api/mock-supabase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    return (await res.json()) as MockResult;
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "Network error" } };
  }
}

const auth: MockAuth = {
  getUser: () => call({ kind: "auth", action: "getUser" }),
  async getSession() {
    const r = await call({ kind: "auth", action: "getUser" });
    return { data: { session: r.data?.user ? { user: r.data.user } : null }, error: null };
  },
  signUp: ({ email, password }) => call({ kind: "auth", action: "signUp", email, password }),
  signInWithPassword: ({ email, password }) =>
    call({ kind: "auth", action: "signIn", email, password }),
  async signInWithOAuth({ options }) {
    // No real Google/Apple in demo mode: sign in as the demo user instead.
    const r = await call({ kind: "auth", action: "demo" });
    if (!r.error) window.location.href = options?.redirectTo ?? "/dashboard";
    return r;
  },
  async signOut() {
    const r = await call({ kind: "auth", action: "signOut" });
    return { error: r.error };
  },
  async exchangeCodeForSession() {
    return { data: { session: null }, error: null };
  },
  onAuthStateChange() {
    return { data: { subscription: { unsubscribe() {} } } };
  },
};

let client: ReturnType<typeof createMockClient> | null = null;

export function createBrowserMockClient() {
  return (client ??= createMockClient((req) => call(req), auth));
}
