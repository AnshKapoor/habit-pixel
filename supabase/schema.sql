-- Run once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- One row per user holding their whole habit list as JSON.

create table if not exists public.habit_backups (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row level security: each signed-in user can only see and change their own backup.
alter table public.habit_backups enable row level security;

create policy "Read own backup" on public.habit_backups
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Create own backup" on public.habit_backups
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Update own backup" on public.habit_backups
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Delete own backup" on public.habit_backups
  for delete to authenticated using ((select auth.uid()) = user_id);
