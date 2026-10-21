-- =====================================================================
-- Demo data seeder. Call seed_demo_household(<household_id>) to populate a
-- realistic multi-currency UHNI portfolio for exploration. No-ops if the
-- household already has accounts. Safe to expose to authenticated members.
-- =====================================================================

create or replace function public.seed_demo_household(p_household_id uuid)
returns void language plpgsql security definer as $$
declare
  v_self uuid;
  v_spouse uuid;
  v_child1 uuid;
  v_child2 uuid;
  v_trust uuid;
  v_llc uuid;
  v_brokerage uuid;
  v_401k uuid;
  v_home uuid;
  d date;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household';
  end if;
  if exists (select 1 from public.accounts where household_id = p_household_id) then
    return; -- already has data
  end if;

  select id into v_self from public.owners
    where household_id = p_household_id and is_default order by created_at limit 1;
  if v_self is null then
    insert into public.owners (household_id, name, kind, relationship, is_default, color)
      values (p_household_id, 'You', 'individual', 'Self', true, '#2563eb')
      returning id into v_self;
  end if;

  insert into public.owners (household_id, name, kind, relationship, color) values
    (p_household_id, 'Spouse', 'individual', 'Spouse', '#db2777') returning id into v_spouse;
  insert into public.owners (household_id, name, kind, relationship, color) values
    (p_household_id, 'Emma (daughter)', 'individual', 'Child', '#f59e0b') returning id into v_child1;
  insert into public.owners (household_id, name, kind, relationship, color) values
    (p_household_id, 'Liam (son)', 'individual', 'Child', '#10b981') returning id into v_child2;
  insert into public.owners (household_id, name, kind, trust_type, grantor, beneficiaries, color) values
    (p_household_id, 'Family Revocable Trust', 'trust', 'Revocable', 'You & Spouse', 'Emma, Liam', '#8b5cf6')
    returning id into v_trust;
  insert into public.owners (household_id, name, kind, legal_name, color) values
    (p_household_id, 'Holdings LLC', 'llc', 'Family Holdings LLC', '#0ea5e9') returning id into v_llc;

  -- Exchange rates (relative to USD)
  insert into public.exchange_rates (household_id, base_currency, quote_currency, rate, source) values
    (p_household_id, 'USD', 'EUR', 0.92, 'demo'),
    (p_household_id, 'USD', 'GBP', 0.79, 'demo'),
    (p_household_id, 'USD', 'INR', 83.20, 'demo'),
    (p_household_id, 'USD', 'JPY', 156.00, 'demo'),
    (p_household_id, 'USD', 'CHF', 0.90, 'demo'),
    (p_household_id, 'USD', 'SGD', 1.35, 'demo');

  -- Accounts
  insert into public.accounts (household_id, owner_id, name, type, currency, cash_balance_minor, interest_rate_pct) values
    (p_household_id, v_self, 'Chase Checking', 'checking', 'USD', 8500000, 0.01),
    (p_household_id, v_self, 'Amex High-Yield Savings', 'savings', 'USD', 25000000, 4.30),
    (p_household_id, v_spouse, 'HSBC UK Current', 'checking', 'GBP', 4000000, 1.50);

  insert into public.accounts (household_id, owner_id, name, type, currency, cash_balance_minor) values
    (p_household_id, v_self, 'Fidelity Brokerage', 'brokerage', 'USD', 5000000)
    returning id into v_brokerage;
  insert into public.accounts (household_id, owner_id, name, type, currency, cash_balance_minor) values
    (p_household_id, v_self, 'Vanguard 401(k)', '401k', 'USD', 0)
    returning id into v_401k;
  insert into public.accounts (household_id, owner_id, name, type, currency, cash_balance_minor) values
    (p_household_id, v_spouse, 'Roth IRA', 'roth_ira', 'USD', 0),
    (p_household_id, v_child1, '529 College Plan', '529', 'USD', 9000000),
    (p_household_id, v_self, 'Coinbase', 'crypto', 'USD', 0);

  -- Holdings
  insert into public.holdings (household_id, account_id, name, class, currency, quantity, unit_price_minor, cost_basis_minor) values
    (p_household_id, v_brokerage, 'AAPL', 'equity', 'USD', 1200, 21500, 14000000),
    (p_household_id, v_brokerage, 'VTI', 'etf', 'USD', 3000, 27800, 60000000),
    (p_household_id, v_brokerage, 'US Treasury 10Y', 'bond', 'USD', 500, 98000, 49000000),
    (p_household_id, v_401k, 'VFIAX (S&P 500)', 'mutual_fund', 'USD', 4200, 52000, 150000000),
    (p_household_id, v_401k, 'VBTLX (Bonds)', 'mutual_fund', 'USD', 5000, 9800, 49000000);

  -- Assets
  insert into public.assets (household_id, owner_id, name, class, currency, current_value_minor, purchase_value_minor, is_appreciating, annual_growth_pct) values
    (p_household_id, v_self, 'Primary Residence', 'real_estate', 'USD', 240000000, 180000000, true, 4),
    (p_household_id, v_trust, 'Villa in Provence', 'real_estate', 'EUR', 110000000, 90000000, true, 3),
    (p_household_id, v_self, 'Gold Bullion', 'gold', 'USD', 12000000, 8000000, true, 5),
    (p_household_id, v_spouse, 'Art Collection', 'art', 'USD', 30000000, 22000000, true, 6),
    (p_household_id, v_self, 'Tesla Model X', 'vehicle', 'USD', 6000000, 9500000, false, -12),
    (p_household_id, v_llc, 'Private Equity Fund LP', 'private_equity', 'USD', 50000000, 35000000, true, 12),
    (p_household_id, v_self, 'Seed-stage startup stake', 'venture', 'USD', 15000000, 5000000, true, 20),
    (p_household_id, v_llc, 'Family Business (40%)', 'business', 'USD', 120000000, 60000000, true, 10);

  -- Liabilities
  insert into public.liabilities (household_id, owner_id, name, type, currency, balance_minor, original_amount_minor, interest_rate_pct, monthly_payment_minor) values
    (p_household_id, v_self, 'Primary Home Mortgage', 'mortgage', 'USD', 90000000, 130000000, 6.25, 550000),
    (p_household_id, v_self, 'Auto Loan', 'auto_loan', 'USD', 3500000, 7000000, 5.90, 95000),
    (p_household_id, v_self, 'Securities-Backed Line', 'sbl', 'USD', 20000000, 20000000, 7.50, 0);

  -- Income streams
  insert into public.income_sources (household_id, owner_id, name, type, currency, expected_amount_minor, cadence) values
    (p_household_id, v_self, 'Executive Salary', 'salary', 'USD', 4500000, 'monthly'),
    (p_household_id, v_spouse, 'Consulting', 'business', 'USD', 1500000, 'monthly'),
    (p_household_id, v_trust, 'Provence Rental', 'rental', 'EUR', 400000, 'monthly'),
    (p_household_id, v_self, 'Dividend Income', 'stock_dividend', 'USD', 1200000, 'quarterly'),
    (p_household_id, v_llc, 'Business Distribution', 'business_dividend', 'USD', 7500000, 'quarterly');

  -- Expenses
  insert into public.expenses (household_id, owner_id, description, category, currency, amount_minor, is_recurring, cadence) values
    (p_household_id, v_self, 'Mortgage Payment', 'mortgage', 'USD', 550000, true, 'monthly'),
    (p_household_id, v_self, 'Property Taxes', 'taxes', 'USD', 3000000, true, 'annually'),
    (p_household_id, v_self, 'Private School Tuition', 'education', 'USD', 500000, true, 'monthly'),
    (p_household_id, v_spouse, 'Household & Lifestyle', 'shopping', 'USD', 1200000, true, 'monthly'),
    (p_household_id, v_self, 'Travel', 'travel', 'USD', 8000000, true, 'annually'),
    (p_household_id, v_self, 'Charitable Giving', 'charity', 'USD', 5000000, true, 'annually');

  -- Goals
  insert into public.goals (household_id, owner_id, name, type, currency, target_minor, manual_saved_minor, target_date) values
    (p_household_id, null, 'Emergency Fund (12 months)', 'emergency', 'USD', 60000000, 25000000, null),
    (p_household_id, v_child1, 'Emma''s College Fund', 'education', 'USD', 40000000, 9000000, (current_date + interval '8 years')::date),
    (p_household_id, v_child2, 'Liam''s College Fund', 'education', 'USD', 40000000, 2000000, (current_date + interval '12 years')::date),
    (p_household_id, null, 'Retirement Nest Egg', 'retirement', 'USD', 1000000000, 350000000, (current_date + interval '18 years')::date);

  -- Backfill 12 months of history for the home and brokerage so the
  -- net-worth trend chart has a meaningful curve.
  select id into v_home from public.assets
    where household_id = p_household_id and name = 'Primary Residence' limit 1;

  for i in 1..12 loop
    d := (date_trunc('month', current_date) - (make_interval(months => 12 - i)))::date;
    insert into public.valuations (household_id, holdable_type, holdable_id, as_of_date, value_minor, currency)
      values (p_household_id, 'asset', v_home, d, 180000000 + (i * 5000000), 'USD')
      on conflict do nothing;
    insert into public.valuations (household_id, holdable_type, holdable_id, as_of_date, value_minor, currency)
      values (p_household_id, 'account', v_brokerage, d, 3000000 + (i * 170000), 'USD')
      on conflict do nothing;
  end loop;
end; $$;

grant execute on function public.seed_demo_household(uuid) to authenticated;
