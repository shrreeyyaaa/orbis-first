-- =====================================================================
-- Gamification: earned achievements and an optional health-score history.
-- All household-scoped under the same RLS model.
-- =====================================================================

-- Earned achievements / milestones (one row per unlocked key).
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  key text not null,
  earned_at timestamptz not null default now(),
  unique (household_id, key)
);
create index achievements_household_idx on public.achievements(household_id);

-- Optional daily snapshot of the financial health score (for a sparkline).
create table public.score_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  as_of_date date not null default current_date,
  score int not null,
  unique (household_id, as_of_date)
);
create index score_snapshots_household_idx on public.score_snapshots(household_id);

alter table public.achievements enable row level security;
alter table public.score_snapshots enable row level security;

create policy "achievements_select" on public.achievements
  for select using (public.is_household_member(household_id));
create policy "achievements_modify" on public.achievements
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "score_snapshots_select" on public.score_snapshots
  for select using (public.is_household_member(household_id));
create policy "score_snapshots_modify" on public.score_snapshots
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));