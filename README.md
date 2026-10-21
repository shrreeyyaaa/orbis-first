# Orbis

A net-worth tracker built for HNI / UHNI families in the US market. Track every
account, investment, property, and private holding across family members and
legal entities (trusts, LLCs) — entered in **any currency** and rolled up into a
single **reporting currency**. Includes a non-destructive **what-if simulation**
sandbox with a future currency converter.

## Features

- **Complete net worth** — bank/cash accounts, brokerage & retirement accounts
  (401k, IRA, Roth, 529, HSA, pension), investment holdings (stocks, ETFs, mutual
  funds, bonds, crypto), real estate, gold, art, vehicles, private equity,
  venture, and business interests, minus all liabilities.
- **Multi-currency** — every item keeps its native currency; a household
  reporting currency (and a per-user display currency) converts everything via an
  exchange-rate table with optional one-click live refresh.
- **Family & entities** — assign ownership to individuals, trusts, LLCs,
  foundations, and estates; filter the whole app to any member or entity.
- **Cash flow** — income streams (salary, business, dividends, rent, interest,
  trust distributions) and expenses (mortgage/loan EMIs, tuition, lifestyle,
  taxes, giving), annualized.
- **Goals** — education (529), emergency fund, retirement, major purchases, and
  philanthropy with progress tracking.
- **Insights & Ask Orbis** — a rule-based insights/recommendations feed (emergency
  fund, concentration, savings rate, leverage, goals off-track, data quality) and an
  "Ask Orbis" assistant that answers questions about your own data. Works without any
  API key (built-in responder); add an OpenAI/Anthropic key to enable the full LLM.
- **Simulation** — project net worth forward under editable growth/inflation/
  contribution assumptions, add hypothetical assets, and use the future currency
  converter (drift or interest-rate-parity forward, break-even rate, and a
  sensitivity table) to decide the right rate to convert at.

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS + Radix UI primitives (shadcn-style)
- Supabase (Postgres, Auth, Row-Level Security)
- Recharts for visualizations

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project, then copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Apply the database schema. Either run the SQL files in `supabase/migrations`
   in order via the Supabase SQL editor, or use the Supabase CLI:

```bash
supabase db push
```

4. Run the dev server:

```bash
npm run dev
```

5. Sign up, complete onboarding (name your family office and pick a reporting
   currency), then click **Load sample data** on the dashboard to explore a
   realistic portfolio — or start adding your own.

## Money & currency model

All amounts are stored as integer **minor units** in each record's native
currency (cents for USD, pence for GBP, whole yen for JPY, etc. — precision
varies per currency). Net worth converts each item into the household reporting
currency using the most recent rate in `exchange_rates`. Items in a currency
without a rate are counted 1:1 and flagged in the UI.

Live rates are fetched from the free, no-key ECB-backed Frankfurter API; you can
also enter/override any rate manually in Settings.

See `SETUP_GUIDE.md` for a deeper walkthrough.

## Demo mode (no Supabase needed)

For a quick local look, set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` and run
`npm run dev`. The app then uses a file-backed stand-in (`.mock-db.json`, git-ignored)
seeded with a sample household. Sign in with `demo@orbis.dev` / `demo1234`, or
use any email to create an account. Delete `.mock-db.json` to reset. Demo mode is
strictly opt-in and must never be enabled in production.

## Deploying to Vercel

1. Import this repository in Vercel (framework preset: **Next.js**, defaults are fine).
2. Add these environment variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - optional: `NEXT_PUBLIC_ENABLE_APPLE_SSO=false`, `EXCHANGE_RATE_API_BASE`,
     `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` for the full assistant
3. Deploy, then in Supabase -> Authentication -> URL Configuration set **Site URL**
   to your Vercel URL and add `https://<your-domain>/**` to **Redirect URLs**.
4. Before inviting real users, configure custom SMTP in Supabase -> Authentication ->
   Emails (the built-in sender only reaches your Supabase team members), and enable
   or hide the Google provider.
