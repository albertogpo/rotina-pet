create table if not exists public.meal_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_occurrence_id uuid not null references public.meal_occurrences(id) on delete cascade,
  notification_kind text not null default 'due',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (meal_occurrence_id, notification_kind)
);

create index if not exists meal_notification_log_user_idx
  on public.meal_notification_log (user_id, sent_at desc);

alter table public.meal_notification_log enable row level security;

create policy "Users can view their own notification log"
  on public.meal_notification_log
  for select
  using (auth.uid() = user_id);
