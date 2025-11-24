-- Unique constraint to prevent duplicate performance entries per trainer, team and date
alter table public.performance_entries
  add constraint performance_entries_trainer_team_date_unique
    unique (trainer_id, team_id, date);
