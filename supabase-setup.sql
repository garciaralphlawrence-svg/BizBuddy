-- Biz Buddy Supabase setup (demo-safe migration path)
-- This keeps your current frontend logic and syncs local state to one cloud table.

create table if not exists public.app_state (
    key text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- NOTE:
-- This policy allows anonymous read/write for demo use because the app currently
-- has client-side auth only. Tighten this before production.
drop policy if exists "anon_full_access_app_state" on public.app_state;
create policy "anon_full_access_app_state"
on public.app_state
for all
to anon
using (true)
with check (true);
