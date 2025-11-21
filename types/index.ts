export type Trainer = {
  id: string;
  name: string;
  email: string | null;
  hourly_rate: number | null;
  is_active: boolean;
  created_at: string | null;
  created_by: string | null;
};

export type PerformanceEntry = {
  id: string;
  trainer_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  activity: string | null;
  location: string | null;
  notes: string | null;
  hourly_rate: number | null;
  cost: number | null;
  created_at: string | null;
  created_by: string | null;
  trainer?: Trainer;
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: 'leiter' | 'trainer';
  created_at: string | null;
};
