-- =====================================================================
-- Atlas Wealth - full schema
-- Households, members, owners (people + trusts/LLCs), institutions,
-- accounts, securities, holdings, assets, liabilities, valuations,
-- ownership splits, income, expenses, goals, currencies + FX rates,
-- and what-if simulation scenarios. RLS scoped to household members.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================
-- updated_at helper
-- =====================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- =====================================================
-- CURRENCIES (global reference) + EXCHANGE RATES
-- =====================================================
create table public.currencies (
  code text primary key,
  symbol text not null,
  name text not null,
  minor_digits int not null default 2
);

insert into public.currencies (code, symbol, name, minor_digits) values
  ('USD','$','US Dollar',2),
  ('EUR','€','Euro',2),
  ('GBP','£','British Pound',2),
  ('CHF','CHF','Swiss Franc',2),
  ('JPY','¥','Japanese Yen',0),
  ('CNY','¥','Chinese Yuan',2),
  ('HKD','HK$','Hong Kong Dollar',2),
  ('SGD','S$','Singapore Dollar',2),
  ('AUD','A$','Australian Dollar',2),
  ('CAD','C$','Canadian Dollar',2),
  ('INR','₹','Indian Rupee',2),
  ('AED','د.إ','UAE Dirham',2),
  ('SAR','﷼','Saudi Riyal',2),
  ('BHD','BD','Bahraini Dinar',3),
  ('BRL','R$','Brazilian Real',2),
  ('ZAR','R','South African Rand',2);

-- =====================================================
-- HOUSEHOLDS
-- =====================================================
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reporting_currency text not null default 'USD' references public.currencies(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.member_role as enum ('admin', 'member');

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  display_name text,
  display_currency text references public.currencies(code),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  role public.member_role not null default 'member',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz
);
create index household_invites_token_idx on public.household_invites(token);

-- =====================================================
-- EXCHANGE RATES (per household, manual or fetched)
-- rate = how many units of quote_currency per 1 unit base_currency.
-- =====================================================
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  base_currency text not null references public.currencies(code),
  quote_currency text not null references public.currencies(code),
  rate numeric(20,8) not null check (rate > 0),
  as_of_date date not null default current_date,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (household_id, base_currency, quote_currency, as_of_date)
);
create index exchange_rates_household_idx on public.exchange_rates(household_id);
create index exchange_rates_pair_idx on public.exchange_rates(household_id, base_currency, quote_currency, as_of_date desc);

-- =====================================================
-- OWNERS (family members + legal entities)
-- =====================================================
create type public.owner_kind as enum
  ('individual', 'joint', 'trust', 'llc', 'corporation', 'foundation', 'estate');

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind public.owner_kind not null default 'individual',
  -- link to a login user when this owner is also an app member
  member_user_id uuid references auth.users(id) on delete set null,
  relationship text,            -- e.g. Self, Spouse, Son, Daughter
  date_of_birth date,
  -- legal-entity / trust specifics
  legal_name text,
  trust_type text,              -- revocable / irrevocable / etc
  grantor text,
  beneficiaries text,
  color text,
  is_default boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index owners_household_idx on public.owners(household_id);

-- =====================================================
-- INSTITUTIONS (banks / brokerages / custodians)
-- =====================================================
create type public.institution_kind as enum
  ('bank', 'brokerage', 'custodian', 'crypto_exchange', 'insurer', 'other');

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind public.institution_kind not null default 'bank',
  notes text,
  created_at timestamptz not null default now()
);
create index institutions_household_idx on public.institutions(household_id);

-- =====================================================
-- ACCOUNTS (financial accounts)
-- =====================================================
create type public.account_type as enum (
  'checking', 'savings', 'money_market', 'cd',
  'brokerage', 'ira', 'roth_ira', '401k', '403b', 'hsa', '529', 'pension',
  'trust_account', 'crypto', 'cash', 'other'
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  institution_id uuid references public.institutions(id) on delete set null,
  name text not null,
  type public.account_type not null,
  currency text not null default 'USD' references public.currencies(code),
  -- cash/sweep balance held directly in the account (investments add holdings on top)
  cash_balance_minor bigint not null default 0,
  interest_rate_pct numeric(8,4),
  maturity_date date,
  opened_on date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_household_idx on public.accounts(household_id);
create index accounts_owner_idx on public.accounts(owner_id);

-- =====================================================
-- SECURITIES (reference for public-market holdings)
-- =====================================================
create type public.asset_class as enum (
  'equity', 'etf', 'mutual_fund', 'bond', 'cash',
  'real_estate', 'land', 'vehicle', 'gold', 'precious_metal',
  'art', 'collectible', 'jewelry',
  'private_equity', 'venture', 'business', 'hedge_fund',
  'crypto', 'life_insurance', 'annuity', 'other'
);

create table public.securities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  symbol text,
  name text not null,
  class public.asset_class not null default 'equity',
  currency text not null default 'USD' references public.currencies(code),
  last_price_minor bigint,
  last_price_at timestamptz,
  created_at timestamptz not null default now()
);
create index securities_household_idx on public.securities(household_id);

-- =====================================================
-- HOLDINGS (positions within investment accounts)
-- market value = quantity * unit_price_minor (in holding currency)
-- =====================================================
create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  security_id uuid references public.securities(id) on delete set null,
  name text not null,
  class public.asset_class not null default 'equity',
  currency text not null default 'USD' references public.currencies(code),
  quantity numeric(28,8) not null default 0,
  unit_price_minor bigint not null default 0,
  cost_basis_minor bigint,
  as_of_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index holdings_household_idx on public.holdings(household_id);
create index holdings_account_idx on public.holdings(account_id);

-- =====================================================
-- ASSETS (real estate, physical, private, business)
-- =====================================================
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  name text not null,
  class public.asset_class not null default 'real_estate',
  currency text not null default 'USD' references public.currencies(code),
  current_value_minor bigint not null default 0,
  purchase_value_minor bigint,
  purchase_date date,
  is_appreciating boolean not null default true,
  annual_growth_pct numeric(8,4),   -- default assumption for simulations
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_household_idx on public.assets(household_id);
create index assets_owner_idx on public.assets(owner_id);

-- =====================================================
-- LIABILITIES
-- =====================================================
create type public.liability_type as enum (
  'mortgage', 'heloc', 'auto_loan', 'personal_loan', 'student_loan',
  'margin_loan', 'sbl', 'business_loan', 'credit_card', 'other'
);

create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  name text not null,
  type public.liability_type not null,
  currency text not null default 'USD' references public.currencies(code),
  balance_minor bigint not null default 0,
  original_amount_minor bigint,
  interest_rate_pct numeric(8,4),
  monthly_payment_minor bigint,
  linked_asset_id uuid references public.assets(id) on delete set null,
  start_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index liabilities_household_idx on public.liabilities(household_id);
create index liabilities_owner_idx on public.liabilities(owner_id);

-- =====================================================
-- VALUATIONS (time-series snapshots, native currency)
-- holdable_type: account | holding | asset | liability
-- =====================================================
create type public.holdable_type as enum ('account', 'holding', 'asset', 'liability');

create table public.valuations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  holdable_type public.holdable_type not null,
  holdable_id uuid not null,
  as_of_date date not null default current_date,
  value_minor bigint not null,
  currency text not null default 'USD' references public.currencies(code),
  note text,
  created_at timestamptz not null default now(),
  unique (holdable_type, holdable_id, as_of_date)
);
create index valuations_household_idx on public.valuations(household_id);
create index valuations_holdable_idx on public.valuations(holdable_type, holdable_id, as_of_date desc);

-- =====================================================
-- OWNERSHIP SPLITS (optional override of a holdable's primary owner)
-- If rows exist for a holdable they define the split; else primary owner = 100%.
-- =====================================================
create table public.ownership (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  holdable_type public.holdable_type not null,
  holdable_id uuid not null,
  owner_id uuid not null references public.owners(id) on delete cascade,
  percent numeric(7,4) not null check (percent > 0 and percent <= 100),
  created_at timestamptz not null default now(),
  unique (holdable_type, holdable_id, owner_id)
);
create index ownership_household_idx on public.ownership(household_id);
create index ownership_holdable_idx on public.ownership(holdable_type, holdable_id);

-- =====================================================
-- INCOME (streams + entries) and EXPENSES
-- =====================================================
create type public.income_type as enum (
  'salary', 'business', 'business_dividend', 'stock_dividend', 'interest',
  'rental', 'capital_gains', 'royalty', 'trust_distribution', 'k1', 'other'
);
create type public.cadence as enum
  ('one_time', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually');

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  name text not null,
  type public.income_type not null,
  currency text not null default 'USD' references public.currencies(code),
  expected_amount_minor bigint not null default 0,
  cadence public.cadence not null default 'monthly',
  account_id uuid references public.accounts(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index income_sources_household_idx on public.income_sources(household_id);

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  income_source_id uuid references public.income_sources(id) on delete set null,
  owner_id uuid not null references public.owners(id) on delete restrict,
  received_on date not null default current_date,
  amount_minor bigint not null,
  currency text not null default 'USD' references public.currencies(code),
  account_id uuid references public.accounts(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index income_entries_household_idx on public.income_entries(household_id);

create type public.expense_category as enum (
  'housing', 'mortgage', 'loan_payment', 'utilities', 'groceries', 'dining',
  'transport', 'travel', 'healthcare', 'insurance', 'education', 'childcare',
  'taxes', 'staff', 'entertainment', 'shopping', 'charity', 'business', 'other'
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  description text not null,
  category public.expense_category not null default 'other',
  currency text not null default 'USD' references public.currencies(code),
  amount_minor bigint not null,
  spent_on date not null default current_date,
  is_recurring boolean not null default false,
  cadence public.cadence,
  account_id uuid references public.accounts(id) on delete set null,
  liability_id uuid references public.liabilities(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index expenses_household_idx on public.expenses(household_id);

-- =====================================================
-- GOALS
-- =====================================================
create type public.goal_type as enum
  ('education', 'emergency', 'retirement', 'purchase', 'philanthropy', 'custom');

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  name text not null,
  type public.goal_type not null default 'custom',
  currency text not null default 'USD' references public.currencies(code),
  target_minor bigint not null default 0,
  manual_saved_minor bigint not null default 0,
  monthly_contribution_minor bigint not null default 0,
  target_date date,
  priority int not null default 3,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_household_idx on public.goals(household_id);

-- links a goal to funding holdables (accounts/assets count toward progress)
create table public.goal_links (
  goal_id uuid not null references public.goals(id) on delete cascade,
  holdable_type public.holdable_type not null,
  holdable_id uuid not null,
  primary key (goal_id, holdable_type, holdable_id)
);

-- =====================================================
-- SIMULATION SCENARIOS (non-destructive what-if)
-- =====================================================
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  base_date date not null default current_date,
  horizon_years int not null default 10,
  inflation_pct numeric(8,4) not null default 2.5,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scenarios_household_idx on public.scenarios(household_id);

-- default annual growth assumption per asset class within a scenario
create table public.scenario_growth (
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  asset_class public.asset_class not null,
  annual_growth_pct numeric(8,4) not null default 0,
  primary key (scenario_id, asset_class)
);

-- per-asset overrides + hypothetical assets
create table public.scenario_overrides (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  holdable_type public.holdable_type,
  holdable_id uuid,
  label text,
  asset_class public.asset_class,
  currency text references public.currencies(code),
  override_value_minor bigint,
  annual_growth_pct numeric(8,4),
  monthly_contribution_minor bigint,
  is_removed boolean not null default false,
  is_hypothetical boolean not null default false,
  created_at timestamptz not null default now()
);
create index scenario_overrides_scenario_idx on public.scenario_overrides(scenario_id);

-- future FX assumptions for the what-if currency converter
create table public.scenario_fx (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  base_currency text not null references public.currencies(code),
  quote_currency text not null references public.currencies(code),
  future_rate numeric(20,8),
  annual_drift_pct numeric(8,4),
  created_at timestamptz not null default now(),
  unique (scenario_id, base_currency, quote_currency)
);

-- =====================================================
-- updated_at triggers
-- =====================================================
create trigger trg_households_updated before update on public.households
  for each row execute function public.set_updated_at();
create trigger trg_owners_updated before update on public.owners
  for each row execute function public.set_updated_at();
create trigger trg_accounts_updated before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger trg_holdings_updated before update on public.holdings
  for each row execute function public.set_updated_at();
create trigger trg_assets_updated before update on public.assets
  for each row execute function public.set_updated_at();
create trigger trg_liabilities_updated before update on public.liabilities
  for each row execute function public.set_updated_at();
create trigger trg_income_sources_updated before update on public.income_sources
  for each row execute function public.set_updated_at();
create trigger trg_goals_updated before update on public.goals
  for each row execute function public.set_updated_at();
create trigger trg_scenarios_updated before update on public.scenarios
  for each row execute function public.set_updated_at();

-- =====================================================
-- Auto-snapshot current values into valuations (history)
-- =====================================================
create or replace function public.snapshot_account()
returns trigger language plpgsql as $$
begin
  insert into public.valuations (household_id, holdable_type, holdable_id, as_of_date, value_minor, currency)
  values (new.household_id, 'account', new.id, current_date, new.cash_balance_minor, new.currency)
  on conflict (holdable_type, holdable_id, as_of_date)
  do update set value_minor = excluded.value_minor, currency = excluded.currency;
  return new;
end; $$;

create or replace function public.snapshot_holding()
returns trigger language plpgsql as $$
begin
  insert into public.valuations (household_id, holdable_type, holdable_id, as_of_date, value_minor, currency)
  values (new.household_id, 'holding', new.id, current_date,
          round(new.quantity * new.unit_price_minor)::bigint, new.currency)
  on conflict (holdable_type, holdable_id, as_of_date)
  do update set value_minor = excluded.value_minor, currency = excluded.currency;
  return new;
end; $$;

create or replace function public.snapshot_asset()
returns trigger language plpgsql as $$
begin
  insert into public.valuations (household_id, holdable_type, holdable_id, as_of_date, value_minor, currency)
  values (new.household_id, 'asset', new.id, current_date, new.current_value_minor, new.currency)
  on conflict (holdable_type, holdable_id, as_of_date)
  do update set value_minor = excluded.value_minor, currency = excluded.currency;
  return new;
end; $$;

create or replace function public.snapshot_liability()
returns trigger language plpgsql as $$
begin
  insert into public.valuations (household_id, holdable_type, holdable_id, as_of_date, value_minor, currency)
  values (new.household_id, 'liability', new.id, current_date, new.balance_minor, new.currency)
  on conflict (holdable_type, holdable_id, as_of_date)
  do update set value_minor = excluded.value_minor, currency = excluded.currency;
  return new;
end; $$;

create trigger trg_snapshot_account after insert or update of cash_balance_minor, currency
  on public.accounts for each row execute function public.snapshot_account();
create trigger trg_snapshot_holding after insert or update of quantity, unit_price_minor, currency
  on public.holdings for each row execute function public.snapshot_holding();
create trigger trg_snapshot_asset after insert or update of current_value_minor, currency
  on public.assets for each row execute function public.snapshot_asset();
create trigger trg_snapshot_liability after insert or update of balance_minor, currency
  on public.liabilities for each row execute function public.snapshot_liability();

-- =====================================================
-- RLS helpers
-- =====================================================
create or replace function public.is_household_member(p_household_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid()
  );
$$;
grant execute on function public.is_household_member(uuid) to authenticated;

create or replace function public.is_household_admin(p_household_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid() and role = 'admin'
  );
$$;
grant execute on function public.is_household_admin(uuid) to authenticated;

-- =====================================================
-- Currency conversion helper: convert minor units of `p_from`
-- into minor units of household reporting currency, using the most
-- recent rate on/before p_date. Falls back to 1:1 if no rate / same ccy.
-- =====================================================
create or replace function public.convert_to_base(
  p_household_id uuid,
  p_amount_minor bigint,
  p_from text,
  p_date date default current_date
) returns bigint language plpgsql stable security definer as $$
declare
  v_base text;
  v_from_digits int;
  v_base_digits int;
  v_rate numeric;
  v_major numeric;
begin
  select reporting_currency into v_base from public.households where id = p_household_id;
  if v_base is null then v_base := 'USD'; end if;
  if p_from = v_base then return p_amount_minor; end if;

  select minor_digits into v_from_digits from public.currencies where code = p_from;
  select minor_digits into v_base_digits from public.currencies where code = v_base;
  v_from_digits := coalesce(v_from_digits, 2);
  v_base_digits := coalesce(v_base_digits, 2);

  -- direct rate from -> base
  select rate into v_rate from public.exchange_rates
   where household_id = p_household_id and base_currency = p_from and quote_currency = v_base
     and as_of_date <= p_date
   order by as_of_date desc limit 1;

  -- inverse rate base -> from
  if v_rate is null then
    select 1 / rate into v_rate from public.exchange_rates
     where household_id = p_household_id and base_currency = v_base and quote_currency = p_from
       and as_of_date <= p_date
     order by as_of_date desc limit 1;
  end if;

  if v_rate is null then v_rate := 1; end if;

  v_major := (p_amount_minor::numeric / (10 ^ v_from_digits)) * v_rate;
  return round(v_major * (10 ^ v_base_digits))::bigint;
end; $$;
grant execute on function public.convert_to_base(uuid, bigint, text, date) to authenticated;

-- =====================================================
-- Onboarding: create household + admin member + default "Self" owner
-- =====================================================
create or replace function public.create_household_with_seed(
  p_household_name text,
  p_user_display_name text,
  p_self_owner_name text,
  p_reporting_currency text default 'USD'
) returns uuid language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.households (name, reporting_currency)
    values (p_household_name, coalesce(p_reporting_currency, 'USD'))
    returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role, display_name)
    values (v_household_id, v_user_id, 'admin', p_user_display_name);

  insert into public.owners (household_id, name, kind, member_user_id, relationship, is_default, color)
    values (v_household_id, p_self_owner_name, 'individual', v_user_id, 'Self', true, '#2563eb');

  return v_household_id;
end; $$;
grant execute on function public.create_household_with_seed(text, text, text, text) to authenticated;

-- =====================================================
-- RLS
-- =====================================================
alter table public.currencies enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.owners enable row level security;
alter table public.institutions enable row level security;
alter table public.accounts enable row level security;
alter table public.securities enable row level security;
alter table public.holdings enable row level security;
alter table public.assets enable row level security;
alter table public.liabilities enable row level security;
alter table public.valuations enable row level security;
alter table public.ownership enable row level security;
alter table public.income_sources enable row level security;
alter table public.income_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.goals enable row level security;
alter table public.goal_links enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_growth enable row level security;
alter table public.scenario_overrides enable row level security;
alter table public.scenario_fx enable row level security;

-- currencies: readable by everyone signed in
create policy "currencies_read" on public.currencies for select using (auth.uid() is not null);

-- households
create policy "households_select" on public.households
  for select using (public.is_household_member(id));
create policy "households_insert" on public.households
  for insert with check (auth.uid() is not null);
create policy "households_update" on public.households
  for update using (public.is_household_admin(id));
create policy "households_delete" on public.households
  for delete using (public.is_household_admin(id));

-- household_members
create policy "members_select" on public.household_members
  for select using (public.is_household_member(household_id));
create policy "members_insert" on public.household_members
  for insert with check (
    (user_id = auth.uid() and role = 'admin'
       and not exists (select 1 from public.household_members m where m.household_id = household_members.household_id))
    or public.is_household_admin(household_id)
  );
create policy "members_update" on public.household_members
  for update using (public.is_household_admin(household_id) or user_id = auth.uid());
create policy "members_delete" on public.household_members
  for delete using (public.is_household_admin(household_id) or user_id = auth.uid());

-- household_invites
create policy "invites_all" on public.household_invites
  for all using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id) and created_by = auth.uid());

-- Generic household-scoped policy for the data tables.
do $$
declare t text;
begin
  foreach t in array array[
    'exchange_rates','owners','institutions','accounts','securities','holdings',
    'assets','liabilities','valuations','ownership','income_sources','income_entries',
    'expenses','goals','scenarios'
  ] loop
    execute format($f$
      create policy "%1$s_select" on public.%1$s
        for select using (public.is_household_member(household_id));
      create policy "%1$s_modify" on public.%1$s
        for all using (public.is_household_member(household_id))
        with check (public.is_household_member(household_id));
    $f$, t);
  end loop;
end $$;

-- goal_links (no household_id column; check via parent goal)
create policy "goal_links_all" on public.goal_links
  for all using (
    exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id))
  ) with check (
    exists (select 1 from public.goals g where g.id = goal_id and public.is_household_member(g.household_id))
  );

-- scenario children (check via parent scenario)
create policy "scenario_growth_all" on public.scenario_growth
  for all using (
    exists (select 1 from public.scenarios s where s.id = scenario_id and public.is_household_member(s.household_id))
  ) with check (
    exists (select 1 from public.scenarios s where s.id = scenario_id and public.is_household_member(s.household_id))
  );
create policy "scenario_overrides_all" on public.scenario_overrides
  for all using (
    exists (select 1 from public.scenarios s where s.id = scenario_id and public.is_household_member(s.household_id))
  ) with check (
    exists (select 1 from public.scenarios s where s.id = scenario_id and public.is_household_member(s.household_id))
  );
create policy "scenario_fx_all" on public.scenario_fx
  for all using (
    exists (select 1 from public.scenarios s where s.id = scenario_id and public.is_household_member(s.household_id))
  ) with check (
    exists (select 1 from public.scenarios s where s.id = scenario_id and public.is_household_member(s.household_id))
  );
