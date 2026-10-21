// Server-only, file-backed stand-in for the Supabase Postgres database.
// Data lives in .mock-db.json at the project root. Mirrors the column
// defaults, unique keys, foreign-key rules, valuation-snapshot triggers and
// the RPC functions from supabase/migrations closely enough to run the app.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Filter, MockQuery, MockResult, MockUser } from "./query";

type Row = Record<string, any>;
interface User {
  id: string;
  email: string;
  password: string;
  created_at: string;
}
interface DB {
  users: User[];
  tables: Record<string, Row[]>;
}

const FILE = path.join(process.cwd(), ".mock-db.json");

export const DEMO_EMAIL = "demo@orbis.dev";
export const DEMO_PASSWORD = "demo1234";

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const uuid = () => crypto.randomUUID();
const addYears = (y: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + y);
  return d.toISOString().slice(0, 10);
};

const DEFAULTS: Record<string, () => Row> = {
  households: () => ({ reporting_currency: "USD", updated_at: now() }),
  household_members: () => ({ role: "member", display_name: null, display_currency: null }),
  household_invites: () => ({
    token: crypto.randomBytes(24).toString("hex"),
    role: "member",
    expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    accepted_at: null,
  }),
  exchange_rates: () => ({ as_of_date: today(), source: "manual" }),
  owners: () => ({
    kind: "individual", member_user_id: null, relationship: null, date_of_birth: null,
    legal_name: null, trust_type: null, grantor: null, beneficiaries: null, color: null,
    is_default: false, notes: null, updated_at: now(),
  }),
  institutions: () => ({ kind: "bank", notes: null }),
  accounts: () => ({
    institution_id: null, currency: "USD", cash_balance_minor: 0, interest_rate_pct: null,
    maturity_date: null, opened_on: null, is_active: true, notes: null, updated_at: now(),
  }),
  securities: () => ({ symbol: null, class: "equity", currency: "USD", last_price_minor: null, last_price_at: null }),
  holdings: () => ({
    security_id: null, class: "equity", currency: "USD", quantity: 0, unit_price_minor: 0,
    cost_basis_minor: null, as_of_date: today(), notes: null, updated_at: now(),
  }),
  assets: () => ({
    class: "real_estate", currency: "USD", current_value_minor: 0, purchase_value_minor: null,
    purchase_date: null, is_appreciating: true, annual_growth_pct: null, notes: null, updated_at: now(),
  }),
  liabilities: () => ({
    currency: "USD", balance_minor: 0, original_amount_minor: null, interest_rate_pct: null,
    monthly_payment_minor: null, linked_asset_id: null, start_date: null, notes: null, updated_at: now(),
  }),
  valuations: () => ({ as_of_date: today(), currency: "USD", note: null }),
  ownership: () => ({}),
  income_sources: () => ({
    currency: "USD", expected_amount_minor: 0, cadence: "monthly", account_id: null,
    is_active: true, notes: null, updated_at: now(),
  }),
  income_entries: () => ({ income_source_id: null, received_on: today(), currency: "USD", account_id: null, note: null }),
  expenses: () => ({
    category: "other", currency: "USD", spent_on: today(), is_recurring: false, cadence: null,
    account_id: null, liability_id: null, notes: null,
  }),
  goals: () => ({
    owner_id: null, type: "custom", currency: "USD", target_minor: 0, manual_saved_minor: 0,
    monthly_contribution_minor: 0, target_date: null, priority: 3, notes: null, updated_at: now(),
  }),
  achievements: () => ({ earned_at: now() }),
  score_snapshots: () => ({ as_of_date: today() }),
};

const NO_ID = new Set(["household_members"]);

const UNIQUE: Record<string, string[][]> = {
  household_members: [["household_id", "user_id"]],
  household_invites: [["token"]],
  exchange_rates: [["household_id", "base_currency", "quote_currency", "as_of_date"]],
  valuations: [["holdable_type", "holdable_id", "as_of_date"]],
  ownership: [["holdable_type", "holdable_id", "owner_id"]],
  achievements: [["household_id", "key"]],
  score_snapshots: [["household_id", "as_of_date"]],
};

type FkRule = { table: string; col: string; ref: string; on: "cascade" | "restrict" | "set null" };
const FKS: FkRule[] = [
  { table: "accounts", col: "owner_id", ref: "owners", on: "restrict" },
  { table: "assets", col: "owner_id", ref: "owners", on: "restrict" },
  { table: "liabilities", col: "owner_id", ref: "owners", on: "restrict" },
  { table: "income_sources", col: "owner_id", ref: "owners", on: "restrict" },
  { table: "income_entries", col: "owner_id", ref: "owners", on: "restrict" },
  { table: "expenses", col: "owner_id", ref: "owners", on: "restrict" },
  { table: "goals", col: "owner_id", ref: "owners", on: "set null" },
  { table: "ownership", col: "owner_id", ref: "owners", on: "cascade" },
  { table: "accounts", col: "institution_id", ref: "institutions", on: "set null" },
  { table: "holdings", col: "account_id", ref: "accounts", on: "cascade" },
  { table: "income_sources", col: "account_id", ref: "accounts", on: "set null" },
  { table: "income_entries", col: "account_id", ref: "accounts", on: "set null" },
  { table: "expenses", col: "account_id", ref: "accounts", on: "set null" },
  { table: "expenses", col: "liability_id", ref: "liabilities", on: "set null" },
  { table: "liabilities", col: "linked_asset_id", ref: "assets", on: "set null" },
  { table: "income_entries", col: "income_source_id", ref: "income_sources", on: "set null" },
  { table: "holdings", col: "security_id", ref: "securities", on: "set null" },
];

class DbError extends Error {}

// ---------------------------------------------------------------- persistence

function read(): DB {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    const db: DB = { users: [], tables: {} };
    seedDemoAccount(db);
    write(db);
    return db;
  }
}

function write(db: DB) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 1));
}

// ---------------------------------------------------------------- row helpers

const same = (a: unknown, b: unknown) =>
  a === b || (a != null && b != null && String(a) === String(b));

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function test(v: unknown, f: Filter): boolean {
  switch (f.op) {
    case "eq": return same(v, f.val);
    case "neq": return !same(v, f.val);
    case "is": return f.val === null ? v == null : same(v, f.val);
    case "in": return Array.isArray(f.val) && f.val.some((x) => same(v, x));
    case "gt": return v != null && cmp(v, f.val) > 0;
    case "gte": return v != null && cmp(v, f.val) >= 0;
    case "lt": return v != null && cmp(v, f.val) < 0;
    case "lte": return v != null && cmp(v, f.val) <= 0;
  }
}

function clean(v: Row): Row {
  const out: Row = {};
  for (const [k, val] of Object.entries(v ?? {})) if (val !== undefined) out[k] = val;
  return out;
}

function tbl(db: DB, t: string): Row[] {
  return (db.tables[t] ??= []);
}

function checkUnique(db: DB, table: string, row: Row, self?: Row) {
  for (const cols of UNIQUE[table] ?? []) {
    const clash = tbl(db, table).find(
      (r) => r !== self && cols.every((c) => same(r[c], row[c])),
    );
    if (clash)
      throw new DbError(
        `duplicate key value violates unique constraint "${table}_${cols.join("_")}_key"`,
      );
  }
}

function snapshot(db: DB, table: string, r: Row) {
  const map: Record<string, [string, number]> = {
    accounts: ["account", Number(r.cash_balance_minor) || 0],
    holdings: ["holding", Math.round((Number(r.quantity) || 0) * (Number(r.unit_price_minor) || 0))],
    assets: ["asset", Number(r.current_value_minor) || 0],
    liabilities: ["liability", Number(r.balance_minor) || 0],
  };
  const hit = map[table];
  if (!hit) return;
  const [type, value] = hit;
  const d = today();
  const existing = tbl(db, "valuations").find(
    (v) => v.holdable_type === type && v.holdable_id === r.id && v.as_of_date === d,
  );
  if (existing) {
    existing.value_minor = value;
    existing.currency = r.currency;
  } else {
    insertRow(db, "valuations", {
      household_id: r.household_id, holdable_type: type, holdable_id: r.id,
      as_of_date: d, value_minor: value, currency: r.currency,
    });
  }
}

function insertRow(db: DB, table: string, values: Row): Row {
  const row: Row = {
    ...(NO_ID.has(table) ? {} : { id: uuid() }),
    ...(DEFAULTS[table]?.() ?? {}),
    created_at: now(),
    ...clean(values),
  };
  checkUnique(db, table, row);
  tbl(db, table).push(row);
  snapshot(db, table, row);
  return row;
}

function updateRow(db: DB, table: string, row: Row, values: Row) {
  const next = { ...row, ...clean(values) };
  checkUnique(db, table, next, row);
  Object.assign(row, clean(values));
  if ("updated_at" in row) row.updated_at = now();
  snapshot(db, table, row);
}

function deleteRows(db: DB, table: string, rows: Row[]) {
  for (const r of rows) {
    for (const fk of FKS.filter((f) => f.ref === table)) {
      const children = tbl(db, fk.table).filter((c) => c[fk.col] === r.id);
      if (!children.length) continue;
      if (fk.on === "restrict")
        throw new DbError(
          `update or delete on table "${table}" violates foreign key constraint "${fk.table}_${fk.col}_fkey" on table "${fk.table}"`,
        );
      if (fk.on === "set null") children.forEach((c) => (c[fk.col] = null));
      if (fk.on === "cascade") deleteRows(db, fk.table, children);
    }
  }
  db.tables[table] = tbl(db, table).filter((r) => !rows.includes(r));
}

function project(rows: Row[], columns?: string): Row[] {
  if (!columns || columns.trim() === "*") return rows.map((r) => ({ ...r }));
  const cols = columns.split(",").map((c) => c.trim()).filter(Boolean);
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
}

// ---------------------------------------------------------------- queries

export function runQuery(q: MockQuery): MockResult {
  const db = read();
  const match = (r: Row) => q.filters.every((f) => test(r[f.col], f));
  let out: Row[] = [];
  try {
    switch (q.op) {
      case "select":
        out = tbl(db, q.table).filter(match);
        break;
      case "insert":
      case "upsert": {
        const list = (Array.isArray(q.values) ? q.values : [q.values]) as Row[];
        const conflict =
          q.op === "upsert"
            ? (q.onConflict?.split(",").map((s) => s.trim()) ?? ["id"])
            : null;
        for (const v of list) {
          const existing = conflict
            ? tbl(db, q.table).find((r) => conflict.every((c) => same(r[c], v[c])))
            : undefined;
          if (existing) {
            updateRow(db, q.table, existing, v);
            out.push(existing);
          } else {
            out.push(insertRow(db, q.table, v));
          }
        }
        write(db);
        break;
      }
      case "update": {
        for (const r of tbl(db, q.table).filter(match)) {
          updateRow(db, q.table, r, q.values as Row);
          out.push(r);
        }
        write(db);
        break;
      }
      case "delete": {
        out = tbl(db, q.table).filter(match);
        deleteRows(db, q.table, out);
        write(db);
        break;
      }
    }
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }

  if (q.op !== "select" && !q.returning) return { data: null, error: null };

  for (const o of [...q.order].reverse()) {
    out = [...out].sort((a, b) => {
      const av = a[o.col], bv = b[o.col];
      if (av == null && bv == null) return 0;
      if (av == null) return o.ascending ? 1 : -1;
      if (bv == null) return o.ascending ? -1 : 1;
      return o.ascending ? cmp(av, bv) : cmp(bv, av);
    });
  }
  if (q.limit != null) out = out.slice(0, q.limit);
  const rows = project(out, q.columns);

  if (q.single) {
    if (rows.length === 1) return { data: rows[0], error: null };
    if (rows.length === 0 && q.single === "maybe") return { data: null, error: null };
    return {
      data: null,
      error: { message: "JSON object requested, multiple (or no) rows returned" },
    };
  }
  return { data: rows, error: null };
}

// ---------------------------------------------------------------- RPC functions

const isMember = (db: DB, hid: unknown, uid: string | null) =>
  !!uid && tbl(db, "household_members").some((m) => m.household_id === hid && m.user_id === uid);

function createHousehold(db: DB, uid: string | null, a: Row): string {
  if (!uid) throw new DbError("not authenticated");
  const h = insertRow(db, "households", {
    name: a.p_household_name,
    reporting_currency: a.p_reporting_currency ?? "USD",
  });
  insertRow(db, "household_members", {
    household_id: h.id, user_id: uid, role: "admin", display_name: a.p_user_display_name,
  });
  insertRow(db, "owners", {
    household_id: h.id, name: a.p_self_owner_name, kind: "individual", member_user_id: uid,
    relationship: "Self", is_default: true, color: "#2563eb",
  });
  return h.id;
}

function seedDemo(db: DB, uid: string | null, hid: string) {
  if (!isMember(db, hid, uid)) throw new DbError("not a member of this household");
  if (tbl(db, "accounts").some((a) => a.household_id === hid)) return;

  const ins = (t: string, v: Row) => insertRow(db, t, { household_id: hid, ...v });
  const self =
    tbl(db, "owners").find((o) => o.household_id === hid && o.is_default)?.id ??
    ins("owners", { name: "You", kind: "individual", relationship: "Self", is_default: true, color: "#2563eb" }).id;
  const spouse = ins("owners", { name: "Spouse", relationship: "Spouse", color: "#db2777" }).id;
  const child1 = ins("owners", { name: "Emma (daughter)", relationship: "Child", color: "#f59e0b" }).id;
  const child2 = ins("owners", { name: "Liam (son)", relationship: "Child", color: "#10b981" }).id;
  const trust = ins("owners", {
    name: "Family Revocable Trust", kind: "trust", trust_type: "Revocable",
    grantor: "You & Spouse", beneficiaries: "Emma, Liam", color: "#8b5cf6",
  }).id;
  const llc = ins("owners", { name: "Holdings LLC", kind: "llc", legal_name: "Family Holdings LLC", color: "#0ea5e9" }).id;

  for (const [q, rate] of [["EUR", 0.92], ["GBP", 0.79], ["INR", 83.2], ["JPY", 156], ["CHF", 0.9], ["SGD", 1.35]] as const)
    ins("exchange_rates", { base_currency: "USD", quote_currency: q, rate, source: "demo" });

  const acct = (owner_id: string, name: string, type: string, currency: string, cash: number, rate: number | null = null) =>
    ins("accounts", { owner_id, name, type, currency, cash_balance_minor: cash, interest_rate_pct: rate }).id;
  acct(self, "Chase Checking", "checking", "USD", 8500000, 0.01);
  acct(self, "Amex High-Yield Savings", "savings", "USD", 25000000, 4.3);
  acct(spouse, "HSBC UK Current", "checking", "GBP", 4000000, 1.5);
  const brokerage = acct(self, "Fidelity Brokerage", "brokerage", "USD", 5000000);
  const k401 = acct(self, "Vanguard 401(k)", "401k", "USD", 0);
  acct(spouse, "Roth IRA", "roth_ira", "USD", 0);
  acct(child1, "529 College Plan", "529", "USD", 9000000);
  acct(self, "Coinbase", "crypto", "USD", 0);

  const hold = (account_id: string, name: string, cls: string, quantity: number, unit_price_minor: number, cost_basis_minor: number) =>
    ins("holdings", { account_id, name, class: cls, currency: "USD", quantity, unit_price_minor, cost_basis_minor });
  hold(brokerage, "AAPL", "equity", 1200, 21500, 14000000);
  hold(brokerage, "VTI", "etf", 3000, 27800, 60000000);
  hold(brokerage, "US Treasury 10Y", "bond", 500, 98000, 49000000);
  hold(k401, "VFIAX (S&P 500)", "mutual_fund", 4200, 52000, 150000000);
  hold(k401, "VBTLX (Bonds)", "mutual_fund", 5000, 9800, 49000000);

  const asset = (owner_id: string, name: string, cls: string, currency: string, cur: number, buy: number, appr: boolean, g: number) =>
    ins("assets", { owner_id, name, class: cls, currency, current_value_minor: cur, purchase_value_minor: buy, is_appreciating: appr, annual_growth_pct: g });
  const home = asset(self, "Primary Residence", "real_estate", "USD", 240000000, 180000000, true, 4).id;
  asset(trust, "Villa in Provence", "real_estate", "EUR", 110000000, 90000000, true, 3);
  asset(self, "Gold Bullion", "gold", "USD", 12000000, 8000000, true, 5);
  asset(spouse, "Art Collection", "art", "USD", 30000000, 22000000, true, 6);
  asset(self, "Tesla Model X", "vehicle", "USD", 6000000, 9500000, false, -12);
  asset(llc, "Private Equity Fund LP", "private_equity", "USD", 50000000, 35000000, true, 12);
  asset(self, "Seed-stage startup stake", "venture", "USD", 15000000, 5000000, true, 20);
  asset(llc, "Family Business (40%)", "business", "USD", 120000000, 60000000, true, 10);

  const liab = (name: string, type: string, bal: number, orig: number, rate: number, pmt: number) =>
    ins("liabilities", { owner_id: self, name, type, currency: "USD", balance_minor: bal, original_amount_minor: orig, interest_rate_pct: rate, monthly_payment_minor: pmt });
  liab("Primary Home Mortgage", "mortgage", 90000000, 130000000, 6.25, 550000);
  liab("Auto Loan", "auto_loan", 3500000, 7000000, 5.9, 95000);
  liab("Securities-Backed Line", "sbl", 20000000, 20000000, 7.5, 0);

  const inc = (owner_id: string, name: string, type: string, currency: string, amt: number, cadence: string) =>
    ins("income_sources", { owner_id, name, type, currency, expected_amount_minor: amt, cadence });
  inc(self, "Executive Salary", "salary", "USD", 4500000, "monthly");
  inc(spouse, "Consulting", "business", "USD", 1500000, "monthly");
  inc(trust, "Provence Rental", "rental", "EUR", 400000, "monthly");
  inc(self, "Dividend Income", "stock_dividend", "USD", 1200000, "quarterly");
  inc(llc, "Business Distribution", "business_dividend", "USD", 7500000, "quarterly");

  const exp = (owner_id: string, description: string, category: string, amt: number, cadence: string) =>
    ins("expenses", { owner_id, description, category, currency: "USD", amount_minor: amt, is_recurring: true, cadence });
  exp(self, "Mortgage Payment", "mortgage", 550000, "monthly");
  exp(self, "Property Taxes", "taxes", 3000000, "annually");
  exp(self, "Private School Tuition", "education", 500000, "monthly");
  exp(spouse, "Household & Lifestyle", "shopping", 1200000, "monthly");
  exp(self, "Travel", "travel", 8000000, "annually");
  exp(self, "Charitable Giving", "charity", 5000000, "annually");

  const goal = (owner_id: string | null, name: string, type: string, target: number, saved: number, date: string | null) =>
    ins("goals", { owner_id, name, type, currency: "USD", target_minor: target, manual_saved_minor: saved, target_date: date });
  goal(null, "Emergency Fund (12 months)", "emergency", 60000000, 25000000, null);
  goal(child1, "Emma's College Fund", "education", 40000000, 9000000, addYears(8));
  goal(child2, "Liam's College Fund", "education", 40000000, 2000000, addYears(12));
  goal(null, "Retirement Nest Egg", "retirement", 1000000000, 350000000, addYears(18));

  // 12 months of history so the trend chart has a curve.
  const base = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - (12 - i), 1))
      .toISOString()
      .slice(0, 10);
    for (const [type, id, value] of [
      ["asset", home, 180000000 + i * 5000000],
      ["account", brokerage, 3000000 + i * 170000],
    ] as const) {
      const exists = tbl(db, "valuations").some(
        (v) => v.holdable_type === type && v.holdable_id === id && v.as_of_date === d,
      );
      if (!exists)
        insertRow(db, "valuations", { household_id: hid, holdable_type: type, holdable_id: id, as_of_date: d, value_minor: value, currency: "USD" });
    }
  }
}

export function runRpc(fn: string, args: Row, uid: string | null): MockResult {
  const db = read();
  try {
    let data: unknown = null;
    switch (fn) {
      case "create_household_with_seed":
        data = createHousehold(db, uid, args);
        break;
      case "seed_demo_household":
        seedDemo(db, uid, args.p_household_id);
        break;
      case "invite_details": {
        const inv = tbl(db, "household_invites").find((i) => i.token === args.p_token);
        if (!inv) {
          data = [{ household_name: null, role: null, status: "invalid" }];
          break;
        }
        const name = tbl(db, "households").find((h) => h.id === inv.household_id)?.name ?? null;
        const status = inv.accepted_at ? "accepted" : new Date(inv.expires_at) < new Date() ? "expired" : "valid";
        data = [{ household_name: name, role: inv.role, status }];
        break;
      }
      case "accept_invite": {
        if (!uid) throw new DbError("not authenticated");
        const inv = tbl(db, "household_invites").find((i) => i.token === args.p_token);
        if (!inv) throw new DbError("invalid invite");
        if (new Date(inv.expires_at) < new Date()) throw new DbError("invite expired");
        if (!isMember(db, inv.household_id, uid))
          insertRow(db, "household_members", { household_id: inv.household_id, user_id: uid, role: inv.role });
        inv.accepted_at ??= now();
        data = inv.household_id;
        break;
      }
      default:
        throw new DbError(`function ${fn} does not exist in demo mode`);
    }
    write(db);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

// ---------------------------------------------------------------- auth

const toUser = (u: User): MockUser => ({ id: u.id, email: u.email });

export function getUserById(id: string | null | undefined): MockUser | null {
  if (!id) return null;
  const u = read().users.find((x) => x.id === id);
  return u ? toUser(u) : null;
}

export function signUp(email: string, password: string): MockResult<{ user: MockUser | null }> {
  const db = read();
  const e = email.trim().toLowerCase();
  if (db.users.some((u) => u.email === e))
    return { data: { user: null }, error: { message: "User already registered" } };
  if (!password || password.length < 6)
    return { data: { user: null }, error: { message: "Password should be at least 6 characters." } };
  const u: User = { id: uuid(), email: e, password, created_at: now() };
  db.users.push(u);
  write(db);
  return { data: { user: toUser(u) }, error: null };
}

export function signIn(email: string, password: string): MockResult<{ user: MockUser | null }> {
  const u = read().users.find((x) => x.email === email.trim().toLowerCase() && x.password === password);
  if (!u) return { data: { user: null }, error: { message: "Invalid login credentials" } };
  return { data: { user: toUser(u) }, error: null };
}

export function demoUser(): MockUser {
  const db = read();
  let u = db.users.find((x) => x.email === DEMO_EMAIL);
  if (!u) {
    seedDemoAccount(db);
    write(db);
    u = db.users.find((x) => x.email === DEMO_EMAIL)!;
  }
  return toUser(u);
}

function seedDemoAccount(db: DB) {
  if (db.users.some((u) => u.email === DEMO_EMAIL)) return;
  const u: User = { id: uuid(), email: DEMO_EMAIL, password: DEMO_PASSWORD, created_at: now() };
  db.users.push(u);
  const hid = createHousehold(db, u.id, {
    p_household_name: "Demo Family Office",
    p_user_display_name: "Alex",
    p_self_owner_name: "Alex (You)",
    p_reporting_currency: "USD",
  });
  seedDemo(db, u.id, hid);
}
