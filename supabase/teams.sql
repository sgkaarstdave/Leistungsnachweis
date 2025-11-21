-- Tabelle für Mannschaften
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trainer_id uuid references public.trainers(id) on delete set null,
  default_day text,
  default_start_time time,
  default_end_time time,
  training_schedule jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Optional: Verknüpfung von Leistungsnachweis-Einträgen zu Mannschaften
alter table if exists public.performance_entries
  add column if not exists team_id uuid references public.teams(id);

-- Mehrere Trainingstage pro Mannschaft ermöglichen
alter table if exists public.teams
  add column if not exists training_schedule jsonb default '[]'::jsonb;

alter table if exists public.teams
  add column if not exists updated_at timestamptz default now();

-- Row Level Security aktivieren und einfache Policy für authentifizierte Nutzer hinzufügen
alter table if exists public.teams enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'Allow authenticated team management') then
    create policy "Allow authenticated team management" on public.teams
      for all using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;
