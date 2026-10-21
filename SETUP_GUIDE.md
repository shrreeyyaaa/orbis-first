# Setup Guide

This walks you through getting Orbis running against a Supabase backend.

## 1. Prerequisites

- Node.js 18+ (tested on 22)
- A free Supabase account (https://supabase.com)

## 2. Create a Supabase project

1. Create a new project in the Supabase dashboard.
2. Go to **Project Settings -> API** and copy:
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY` (kept server-side)

## 3. Configure environment

```bash
cp .env.example .env.local
# then edit .env.local with the values above
```

## 4. Apply the database schema

Run the migrations in `supabase/migrations` **in order**:

- `0001_foundation.sql` — all tables, enums, RLS policies, currency conversion
  helper, and the onboarding RPC.
- `0002_demo_seed.sql` — the optional `seed_demo_household()` sample-data function.
- `0003_gamification.sql` — achievements and optional health-score history.

### Option A — Supabase SQL editor

Open the SQL editor in the dashboard, paste the contents of each file (oldest
first), and run.

### Option B — Supabase CLI

```bash
supabase link --project-ref <your-ref>
supabase db push
```

## 5. Auth settings

In **Authentication -> Providers -> Email**, this app is configured for
email/password. For local testing you can disable email confirmations so signups
log in immediately (`supabase/config.toml` already sets this for local dev).

## 5b. (Optional) Enable Google & Apple sign-in

The login and signup screens show "Continue with Google / Apple" buttons. To make
them work, enable the providers in Supabase under **Authentication -> Providers**.

Google (free):
1. In the Google Cloud Console, create an OAuth 2.0 Client ID (type: Web).
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Paste the Client ID and Secret into Supabase -> Authentication -> Providers -> Google, and enable it.

Apple (requires a paid Apple Developer account, ~$99/yr):
1. Create a Services ID and a Sign in with Apple key in the Apple Developer portal.
2. Configure the return URL `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Enter the Services ID, Team ID, Key ID, and key into Supabase -> Authentication -> Providers -> Apple.

To hide the Apple button until you configure it, set `NEXT_PUBLIC_ENABLE_APPLE_SSO=false`
in `.env.local`.

New OAuth users with no household are sent into the onboarding wizard automatically.

## 5c. (Optional) Enable the full "Ask Orbis" AI assistant

The app ships with an **Insights** feed and an **Ask Orbis** assistant that work out
of the box - the assistant answers common questions (net worth, allocation, savings
rate, goals, concentration, insights) from your data using a built-in responder.

To upgrade it to a full conversational LLM, add an API key to `.env.local` (pick one):

```bash
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

Restart `npm run dev` after adding it. The assistant only ever uses the signed-in
household's own data and is framed as informational, not financial advice. No key
is required to ship.

## 6. Run

```bash
npm run dev
```

Open http://localhost:3000:

1. **Sign up** with an email + password.
2. **Onboarding** — name your family/office, your name (the first owner), and
   pick a reporting currency.
3. On the **Dashboard**, click **Load sample data** to populate a realistic
   multi-currency portfolio, or start adding real data:
   - **Family** — add members, trusts, and LLCs.
   - **Accounts** — bank, savings, brokerage, retirement, 529, HSA, crypto.
   - **Investments** — holdings inside investment accounts.
   - **Assets** — property, gold, art, vehicles, private equity, venture, business.
   - **Liabilities** — mortgages, loans, lines of credit, cards.
   - **Cash Flow** — income streams and expenses.
   - **Goals** — education, emergency, retirement, and more.
   - **Settings** — reporting currency, your display currency, and exchange rates
     (manual entry or **Fetch live rates**).
   - **Simulate** — project net worth and run the future currency converter.

## Key concepts

### Multi-currency

- Each account/holding/asset/liability/income/expense has its own currency.
- The **reporting currency** (Settings) is what everything rolls up into.
- Your personal **display currency** re-expresses totals just for you via the
  top-bar selector.
- Conversions use `exchange_rates`. Missing pairs are counted 1:1 and flagged.

### Ownership & scope

- Every holding belongs to an owner (person or entity). The scope selector in the
  top bar filters the entire app to "Whole family" or a single owner.
- The `ownership` table can split a single holding across multiple owners by
  percentage (e.g., a jointly owned home).

### Net worth over time

- Editing a value snapshots it into `valuations` (via triggers), building a time
  series that powers the trend charts. The demo seeder backfills 12 months.

## Production build

```bash
npm run build
npm run start
```
