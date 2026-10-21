// Dummy Supabase client used in demo mode. It mimics the small slice of the
// supabase-js query API this app uses and hands each query to an executor
// (direct call on the server, fetch to /api/mock-supabase in the browser).

export const MOCK_COOKIE = "orbis-mock-uid";

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is";
export interface Filter {
  col: string;
  op: FilterOp;
  val: unknown;
}

export interface MockQuery {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  columns?: string;
  values?: unknown;
  filters: Filter[];
  order: { col: string; ascending: boolean }[];
  limit?: number;
  single?: "single" | "maybe";
  returning: boolean;
  onConflict?: string;
}

export interface MockError {
  message: string;
}
export interface MockResult<T = any> {
  data: T;
  error: MockError | null;
}

export type MockRequest =
  | { kind: "query"; query: MockQuery }
  | { kind: "rpc"; fn: string; args: Record<string, unknown> };

export type Executor = (req: MockRequest) => Promise<MockResult>;

class QueryBuilder implements PromiseLike<MockResult> {
  private q: MockQuery;
  constructor(
    private exec: Executor,
    table: string,
  ) {
    this.q = { table, op: "select", columns: "*", filters: [], order: [], returning: false };
  }

  select(columns = "*") {
    this.q.columns = columns;
    if (this.q.op !== "select") this.q.returning = true;
    return this;
  }
  insert(values: unknown) {
    this.q.op = "insert";
    this.q.values = values;
    return this;
  }
  upsert(values: unknown, opts?: { onConflict?: string }) {
    this.q.op = "upsert";
    this.q.values = values;
    this.q.onConflict = opts?.onConflict;
    return this;
  }
  update(values: unknown) {
    this.q.op = "update";
    this.q.values = values;
    return this;
  }
  delete() {
    this.q.op = "delete";
    return this;
  }
  private f(op: FilterOp, col: string, val: unknown) {
    this.q.filters.push({ col, op, val });
    return this;
  }
  eq(col: string, val: unknown) { return this.f("eq", col, val); }
  neq(col: string, val: unknown) { return this.f("neq", col, val); }
  gt(col: string, val: unknown) { return this.f("gt", col, val); }
  gte(col: string, val: unknown) { return this.f("gte", col, val); }
  lt(col: string, val: unknown) { return this.f("lt", col, val); }
  lte(col: string, val: unknown) { return this.f("lte", col, val); }
  in(col: string, val: unknown[]) { return this.f("in", col, val); }
  is(col: string, val: unknown) { return this.f("is", col, val); }
  order(col: string, opts?: { ascending?: boolean }) {
    this.q.order.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.q.limit = n;
    return this;
  }
  single() {
    this.q.single = "single";
    return this;
  }
  maybeSingle() {
    this.q.single = "maybe";
    return this;
  }
  then<A = MockResult, B = never>(
    onFulfilled?: ((v: MockResult) => A | PromiseLike<A>) | null,
    onRejected?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.exec({ kind: "query", query: this.q }).then(onFulfilled, onRejected);
  }
}

export interface MockUser {
  id: string;
  email: string;
}

export interface MockAuth {
  getUser(): Promise<MockResult<{ user: MockUser | null }>>;
  getSession(): Promise<MockResult<{ session: { user: MockUser } | null }>>;
  signUp(args: { email: string; password: string; options?: unknown }): Promise<MockResult>;
  signInWithPassword(args: { email: string; password: string }): Promise<MockResult>;
  signInWithOAuth(args: { provider: string; options?: { redirectTo?: string } }): Promise<MockResult>;
  signOut(): Promise<{ error: MockError | null }>;
  exchangeCodeForSession(code: string): Promise<MockResult>;
  onAuthStateChange(cb: unknown): { data: { subscription: { unsubscribe(): void } } };
}

export function createMockClient(exec: Executor, auth: MockAuth) {
  return {
    from: (table: string) => new QueryBuilder(exec, table),
    rpc: (fn: string, args: Record<string, unknown> = {}) => exec({ kind: "rpc", fn, args }),
    auth,
  };
}

// Demo mode is strictly opt-in so a deployment with missing keys fails loudly
// instead of silently running on the local stand-in.
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
