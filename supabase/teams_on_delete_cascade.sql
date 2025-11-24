-- Ensure performance_entries are removed when a team is deleted
alter table if exists public.performance_entries
  drop constraint if exists performance_entries_team_id_fkey;

alter table if exists public.performance_entries
  add constraint performance_entries_team_id_fkey
    foreign key (team_id)
    references public.teams(id)
    on delete cascade;
