// Domain types mirroring the Supabase schema (the columns the app reads/writes).

export type MemberRole = "admin" | "member";

export type OwnerKind =
  | "individual"
  | "joint"
  | "trust"
  | "llc"
  | "corporation"
  | "foundation"
  | "estate";

export type AccountType =
  | "checking"
  | "savings"
  | "money_market"
  | "cd"
  | "brokerage"
  | "ira"
  | "roth_ira"
  | "401k"
  | "403b"
  | "hsa"
  | "529"
  | "pension"
  | "trust_account"
  | "crypto"
  | "cash"
  | "other";

export type AssetClass =
  | "equity"
  | "etf"
  | "mutual_fund"
  | "bond"
  | "cash"
  | "real_estate"
  | "land"
  | "vehicle"
  | "gold"
  | "precious_metal"
  | "art"
  | "collectible"
  | "jewelry"
  | "private_equity"
  | "venture"
  | "business"
  | "hedge_fund"
  | "crypto"
  | "life_insurance"
  | "annuity"
  | "other";

export type LiabilityType =
  | "mortgage"
  | "heloc"
  | "auto_loan"
  | "personal_loan"
  | "student_loan"
  | "margin_loan"
  | "sbl"
  | "business_loan"
  | "credit_card"
  | "other";

export type HoldableType = "account" | "holding" | "asset" | "liability";

export type IncomeType =
  | "salary"
  | "business"
  | "business_dividend"
  | "stock_dividend"
  | "interest"
  | "rental"
  | "capital_gains"
  | "royalty"
  | "trust_distribution"
  | "k1"
  | "other";

export type Cadence =
  | "one_time"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annually";

export type ExpenseCategory =
  | "housing"
  | "mortgage"
  | "loan_payment"
  | "utilities"
  | "groceries"
  | "dining"
  | "transport"
  | "travel"
  | "healthcare"
  | "insurance"
  | "education"
  | "childcare"
  | "taxes"
  | "staff"
  | "entertainment"
  | "shopping"
  | "charity"
  | "business"
  | "other";

export type GoalType =
  | "education"
  | "emergency"
  | "retirement"
  | "purchase"
  | "philanthropy"
  | "custom";

export interface Household {
  id: string;
  name: string;
  reporting_currency: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string | null;
  display_currency: string | null;
}

export interface Owner {
  id: string;
  household_id: string;
  name: string;
  kind: OwnerKind;
  member_user_id: string | null;
  relationship: string | null;
  date_of_birth: string | null;
  legal_name: string | null;
  trust_type: string | null;
  grantor: string | null;
  beneficiaries: string | null;
  color: string | null;
  is_default: boolean;
  notes: string | null;
}

export interface Institution {
  id: string;
  household_id: string;
  name: string;
  kind: string;
  notes: string | null;
}

export interface Account {
  id: string;
  household_id: string;
  owner_id: string;
  institution_id: string | null;
  name: string;
  type: AccountType;
  currency: string;
  cash_balance_minor: number;
  interest_rate_pct: number | null;
  maturity_date: string | null;
  opened_on: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface Holding {
  id: string;
  household_id: string;
  account_id: string;
  security_id: string | null;
  name: string;
  class: AssetClass;
  currency: string;
  quantity: number;
  unit_price_minor: number;
  cost_basis_minor: number | null;
  as_of_date: string;
  notes: string | null;
}

export interface Asset {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  class: AssetClass;
  currency: string;
  current_value_minor: number;
  purchase_value_minor: number | null;
  purchase_date: string | null;
  is_appreciating: boolean;
  annual_growth_pct: number | null;
  notes: string | null;
}

export interface Liability {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  type: LiabilityType;
  currency: string;
  balance_minor: number;
  original_amount_minor: number | null;
  interest_rate_pct: number | null;
  monthly_payment_minor: number | null;
  linked_asset_id: string | null;
  start_date: string | null;
  notes: string | null;
}

export interface Valuation {
  id: string;
  household_id: string;
  holdable_type: HoldableType;
  holdable_id: string;
  as_of_date: string;
  value_minor: number;
  currency: string;
  note: string | null;
}

export interface IncomeSource {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  type: IncomeType;
  currency: string;
  expected_amount_minor: number;
  cadence: Cadence;
  account_id: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface Expense {
  id: string;
  household_id: string;
  owner_id: string;
  description: string;
  category: ExpenseCategory;
  currency: string;
  amount_minor: number;
  spent_on: string;
  is_recurring: boolean;
  cadence: Cadence | null;
  account_id: string | null;
  liability_id: string | null;
  notes: string | null;
}

export interface Goal {
  id: string;
  household_id: string;
  owner_id: string | null;
  name: string;
  type: GoalType;
  currency: string;
  target_minor: number;
  manual_saved_minor: number;
  monthly_contribution_minor: number;
  target_date: string | null;
  priority: number;
  notes: string | null;
}

export interface ExchangeRate {
  id: string;
  household_id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  as_of_date: string;
  source: string;
}

export interface Scenario {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  base_date: string;
  horizon_years: number;
  inflation_pct: number;
  created_by: string;
}
