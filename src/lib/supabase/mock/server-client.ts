// Server-side dummy client: runs queries directly against the file store,
// acting as the user named in the demo session cookie.
import { createMockClient, type MockAuth } from "./query";
import { getUserById, runQuery, runRpc } from "./store";

export function createServerMockClient(uid: string | null) {
  const auth: MockAuth = {
    async getUser() {
      return { data: { user: getUserById(uid) }, error: null };
    },
    async getSession() {
      const user = getUserById(uid);
      return { data: { session: user ? { user } : null }, error: null };
    },
    async signUp() {
      return { data: null, error: { message: "Use the browser client to sign up in demo mode" } };
    },
    async signInWithPassword() {
      return { data: null, error: { message: "Use the browser client to sign in in demo mode" } };
    },
    async signInWithOAuth() {
      return { data: null, error: { message: "Use the browser client to sign in in demo mode" } };
    },
    async signOut() {
      return { error: null };
    },
    async exchangeCodeForSession() {
      return { data: { session: null }, error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
  };

  return createMockClient(async (req) => {
    if (req.kind === "query") return runQuery(req.query);
    return runRpc(req.fn, req.args, uid);
  }, auth);
}
