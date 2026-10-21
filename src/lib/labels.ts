import type {
  AccountType,
  AssetClass,
  LiabilityType,
  IncomeType,
  ExpenseCategory,
  GoalType,
  OwnerKind,
  Cadence,
} from "@/lib/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  money_market: "Money Market",
  cd: "Certificate of Deposit",
  brokerage: "Brokerage",
  ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  "401k": "401(k)",
  "403b": "403(b)",
  hsa: "HSA",
  "529": "529 College Savings",
  pension: "Pension",
  trust_account: "Trust Account",
  crypto: "Crypto Account",
  cash: "Cash",
  other: "Other",
};

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Stock",
  etf: "ETF",
  mutual_fund: "Mutual Fund",
  bond: "Bond",
  cash: "Cash",
  real_estate: "Real Estate",
  land: "Land",
  vehicle: "Vehicle",
  gold: "Gold",
  precious_metal: "Precious Metal",
  art: "Art",
  collectible: "Collectible",
  jewelry: "Jewelry",
  private_equity: "Private Equity",
  venture: "Venture Investment",
  business: "Business Interest",
  hedge_fund: "Hedge Fund",
  crypto: "Crypto",
  life_insurance: "Life Insurance (Cash Value)",
  annuity: "Annuity",
  other: "Other",
};

// Higher-level allocation buckets used for the dashboard donut.
export const ASSET_CLASS_GROUP: Record<AssetClass, string> = {
  cash: "Cash & Equivalents",
  equity: "Public Equities",
  etf: "Public Equities",
  mutual_fund: "Public Equities",
  bond: "Fixed Income",
  real_estate: "Real Estate",
  land: "Real Estate",
  private_equity: "Private & Alternatives",
  venture: "Private & Alternatives",
  business: "Private & Alternatives",
  hedge_fund: "Private & Alternatives",
  crypto: "Crypto",
  gold: "Physical & Collectibles",
  precious_metal: "Physical & Collectibles",
  art: "Physical & Collectibles",
  collectible: "Physical & Collectibles",
  jewelry: "Physical & Collectibles",
  vehicle: "Physical & Collectibles",
  life_insurance: "Insurance & Annuities",
  annuity: "Insurance & Annuities",
  other: "Other",
};

export const ALLOCATION_GROUPS = [
  "Cash & Equivalents",
  "Public Equities",
  "Fixed Income",
  "Real Estate",
  "Private & Alternatives",
  "Crypto",
  "Physical & Collectibles",
  "Insurance & Annuities",
  "Other",
] as const;

// Muted, jewel-toned luxury palette (navy / gold / emerald / slate / burgundy...).
export const GROUP_COLORS: Record<string, string> = {
  "Cash & Equivalents": "#2E7D5B",
  "Public Equities": "#1A2C4E",
  "Fixed Income": "#6B7A99",
  "Real Estate": "#C29A4E",
  "Private & Alternatives": "#8C3B4A",
  Crypto: "#B5734A",
  "Physical & Collectibles": "#8A9A5B",
  "Insurance & Annuities": "#3E7C86",
  Other: "#9C9488",
};

// Ordered palette for generic series/charts.
export const CHART_COLORS = [
  "#1A2C4E",
  "#C29A4E",
  "#2E7D5B",
  "#6B7A99",
  "#8C3B4A",
  "#8A9A5B",
  "#3E7C86",
  "#B5734A",
];

export const LIABILITY_TYPE_LABELS: Record<LiabilityType, string> = {
  mortgage: "Mortgage",
  heloc: "HELOC",
  auto_loan: "Auto Loan",
  personal_loan: "Personal Loan",
  student_loan: "Student Loan",
  margin_loan: "Margin Loan",
  sbl: "Securities-Backed Line",
  business_loan: "Business Loan",
  credit_card: "Credit Card",
  other: "Other",
};

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  salary: "Salary",
  business: "Business Income",
  business_dividend: "Business Dividend",
  stock_dividend: "Stock Dividend",
  interest: "Interest",
  rental: "Rental Income",
  capital_gains: "Capital Gains",
  royalty: "Royalty",
  trust_distribution: "Trust Distribution",
  k1: "K-1 Income",
  other: "Other",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  housing: "Housing",
  mortgage: "Mortgage Payment",
  loan_payment: "Loan / EMI Payment",
  utilities: "Utilities",
  groceries: "Groceries",
  dining: "Dining",
  transport: "Transport",
  travel: "Travel",
  healthcare: "Healthcare",
  insurance: "Insurance",
  education: "Education / Tuition",
  childcare: "Childcare",
  taxes: "Taxes",
  staff: "Household Staff",
  entertainment: "Entertainment",
  shopping: "Shopping",
  charity: "Charitable Giving",
  business: "Business Expense",
  other: "Other",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  education: "Education Fund",
  emergency: "Emergency Fund",
  retirement: "Retirement",
  purchase: "Major Purchase",
  philanthropy: "Philanthropy",
  custom: "Custom",
};

export const OWNER_KIND_LABELS: Record<OwnerKind, string> = {
  individual: "Individual",
  joint: "Joint",
  trust: "Trust",
  llc: "LLC",
  corporation: "Corporation",
  foundation: "Foundation",
  estate: "Estate",
};

export const CADENCE_LABELS: Record<Cadence, string> = {
  one_time: "One-time",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

// How many times per year a cadence occurs (for annualizing cash flow).
export const CADENCE_PER_YEAR: Record<Cadence, number> = {
  one_time: 1,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  annually: 1,
};

export function annualize(amountMinor: number, cadence: Cadence): number {
  if (cadence === "one_time") return amountMinor;
  return amountMinor * CADENCE_PER_YEAR[cadence];
}

export function monthlyFromCadence(amountMinor: number, cadence: Cadence): number {
  return Math.round(annualize(amountMinor, cadence) / 12);
}
