-- Tabelle für Mannschaften
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trainer_id uuid references public.trainers(id) on delete set null,
  default_day text,
  default_start_time time,
  default_end_time time,
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Optional: Verknüpfung von Leistungsnachweis-Einträgen zu Mannschaften
alter table if exists public.performance_entries
  add column if not exists team_id uuid references public.teams(id);
