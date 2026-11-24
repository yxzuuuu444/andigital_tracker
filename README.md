# Andigital Tracker

A fast, mobile-first personal expense & monthly allowance PWA. Two (or more) users each get a
strictly isolated wallet: Supabase Row Level Security (`auth.uid() = user_id`) on every table.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · Lucide · Supabase (Postgres + Auth + RLS)

---

## 1. Local setup

```bash
npm install
cp .env.local.example .env.local   # then fill in the two values from step 2
npm run dev                        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`.

## 2. Supabase checklist

1. **Create a project** at https://supabase.com/dashboard (any region near you).
2. **Run the schema:** Dashboard → **SQL Editor** → *New query* → paste the full contents of
   `supabase/migrations/0001_andigital_tracker.sql` → **Run**. It is safe to re-run.
   This creates the tables, RLS policies, the new-user category seeder trigger, the month-end
   rollover function (`run_month_rollovers`) and the atomic savings withdrawal (`withdraw_savings`).
3. **Enable anonymous sign-ins (required):** Dashboard → **Authentication → Sign In / Providers**
   → turn on **Allow anonymous sign-ins**. The app has no login screen. Each profile is an anonymous
   account, so this setting must be on. Email sign-in is not used and can stay off.
4. **Get your keys:** Dashboard → **Project Settings → API**:
   - *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`
   - *anon / public* key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   The anon key is safe to expose to the browser. **Never** put the `service_role` key in this app.
5. **Verify isolation (optional but recommended):** open the app, log an expense, press the
   **Profile 1 → Profile 2** button, and confirm Profile 2 starts empty. RLS enforces this in the
   database, not just the UI.

## 3. Environment variables

`.env.local` (local) and the same two variables in your host's dashboard (production):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

If these are missing, the app shows a setup notice on `/login` instead of crashing.

## 4. How the monthly cycle works

- **Allowance:** each month has one *starting* amount (Settings → Allowance). Mid-month *top-ups* and
  *adjustments* are extra entries for that month. Savings can also be moved into the month as a
  "From savings" entry.
- **Month-end rollover:** when the app opens in a new month, `run_month_rollovers` closes every earlier
  month that has data and hasn't been closed yet. Each unspent amount (`allowance − expenses`) above
  zero is credited to Savings as `Rollover from <Mon YYYY>`. A `month_closures` row plus a unique index
  on `(user_id, source_month)` make this exactly-once, so reloading never double-credits.
- **Savings:** balance = rollovers + deposits − withdrawals. Withdraw as an *outside expense* (counts
  against the month) or *add to allowance*. Overdrafts are rejected in the database.
- **Budget modes:** each category has an optional monthly limit and a mode.
  - `Warn only` (`soft_warn`): amber at 80%, rose and a banner once over. Saving is never blocked.
  - `Hard block` (`hard_block`): saving past the limit requires an explicit override checkbox.
    The override is recorded on the expense (`over_budget_override`).

## 4a. Profiles

- The app opens straight into **Profile 1**. The **Switch to Profile 2** button (Home header or
  Settings) swaps between them. Each profile has its own allowance, categories, expenses and savings.
- Profiles live in **this browser**. They don't sync between phone and laptop. Clearing site data or
  uninstalling the home-screen app can lose a profile, so use Settings → **Export all expenses (CSV)**
  for backups.
- Anyone who can open the site can switch profiles. Profiles are only separated from each other,
  not locked behind a password.

## 5. Install as an app (PWA)

- **Android / Chrome:** open the site → menu → *Install app* / *Add to Home screen*.
- **iOS / Safari:** open the site → Share → *Add to Home Screen*.

The manifest is `public/manifest.json`. Icons are SVG (`public/icons/icon.svg`). If you want a PNG
home-screen icon for iOS, export a 180×180 PNG from that SVG as `public/icons/apple-touch-icon.png`
and point `metadata.icons.apple` in `app/layout.tsx` at it. iOS does not accept SVG for home-screen icons.

Each profile's session is kept in the browser, so it stays signed in between visits.

## 6. Deploy (Vercel example)

1. Push this folder to a Git repo and import it at https://vercel.com/new.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under *Environment Variables*.
3. Deploy. Then in Supabase → **Authentication → URL Configuration**, set *Site URL* to your Vercel
   domain so confirmation links and redirects point to the right place.

## 7. Project layout

```
app/
  (app)/            authenticated routes (shared shell + bottom nav)
    page.tsx        Home: hero balance, savings pill, category budgets, recent expenses
    history/        Expenses Log (filters) + Savings Pond
    settings/       allowance & top-ups, categories & limits, CSV export, sign out
components/
  DuckMascot.tsx    SVG duck with mood-driven Framer Motion animations
  AppShell.tsx      max-w-md phone frame, safe areas, toasts, coin-sparkle confirmation
  AddExpenseSheet   one-handed expense entry with live budget preview and hard-block override
  SavingsSheet      withdraw (expense / allowance) and deposit
  BottomNav.tsx     sticky bottom bar with centered + button
lib/
  tracker-context   data layer: loads per-user data, runs rollover, optimistic updates
  budget.ts         budget status and pending-expense preview
  month-stats.ts    monthly totals per category
  profiles.ts       profile storage (Profile 1 / Profile 2 session tokens)
  supabase/         browser Supabase client
supabase/migrations/0001_andigital_tracker.sql   schema, RLS, triggers, RPCs
```

## 8. Notes

- Money is `numeric(12,2)` in Postgres and rounded to cents in the client. Display uses `₱` (PHP).
- CSV export (Settings) downloads all of your expenses.
- The service worker (`public/sw.js`) only enables installability. It never caches financial data.
- Dates are chosen in the user's local time and sent explicitly, so a late-night expense doesn't
  land on the previous day because of UTC.
