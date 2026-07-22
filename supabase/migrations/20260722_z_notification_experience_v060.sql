-- Rotina Pet v0.6.0
-- Fuso horário da rotina, geração server-side das ocorrências,
-- agrupamento de lembretes e deduplicação transacional.

create extension if not exists pgcrypto;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_user_preferences_timezone()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if not exists (
    select 1
    from pg_timezone_names
    where name = new.timezone
  ) then
    raise exception 'Fuso horário inválido: %', new.timezone;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_user_preferences_timezone on public.user_preferences;
create trigger validate_user_preferences_timezone
before insert or update of timezone on public.user_preferences
for each row execute function public.validate_user_preferences_timezone();

alter table public.user_preferences enable row level security;
drop policy if exists "Users can view their own preferences" on public.user_preferences;
drop policy if exists "Users can insert their own preferences" on public.user_preferences;
drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can view their own preferences"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their own preferences"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own preferences"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.ensure_user_preferences(p_timezone text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_preferences public.user_preferences%rowtype;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Fuso horário inválido: %', p_timezone;
  end if;

  insert into public.user_preferences(user_id, timezone)
  values(v_user, p_timezone)
  on conflict (user_id) do nothing;

  select * into v_preferences
  from public.user_preferences
  where user_id = v_user;

  return to_jsonb(v_preferences);
end;
$$;

grant execute on function public.ensure_user_preferences(text) to authenticated;

create or replace function public.update_user_timezone(p_timezone text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_preferences public.user_preferences%rowtype;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Fuso horário inválido: %', p_timezone;
  end if;

  insert into public.user_preferences(user_id, timezone)
  values(v_user, p_timezone)
  on conflict (user_id) do update
    set timezone = excluded.timezone,
        updated_at = now()
  returning * into v_preferences;

  update public.meal_occurrences occurrence
  set scheduled_at = (occurrence.local_date + template.scheduled_time) at time zone p_timezone
  from public.meal_templates template
  where occurrence.meal_template_id = template.id
    and occurrence.user_id = v_user
    and occurrence.status = 'pending'
    and occurrence.local_date >= (now() at time zone p_timezone)::date;

  return to_jsonb(v_preferences);
end;
$$;

grant execute on function public.update_user_timezone(text) to authenticated;

create or replace function public.ensure_meal_occurrences_for_date(p_local_date date)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_timezone text;
  v_inserted integer := 0;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  select timezone into v_timezone
  from public.user_preferences
  where user_id = v_user;

  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');

  with selected_plans as (
    select distinct on (plan.pet_id)
      plan.id,
      plan.user_id,
      plan.pet_id
    from public.diet_plans plan
    join public.pets pet
      on pet.id = plan.pet_id
     and pet.user_id = v_user
     and pet.active = true
    where plan.user_id = v_user
      and plan.starts_on <= p_local_date
      and (plan.ends_on is null or plan.ends_on >= p_local_date)
    order by plan.pet_id, plan.starts_on desc, plan.created_at desc
  ), inserted as (
    insert into public.meal_occurrences(
      user_id,
      pet_id,
      meal_template_id,
      local_date,
      scheduled_at
    )
    select
      selected.user_id,
      selected.pet_id,
      template.id,
      p_local_date,
      (p_local_date + template.scheduled_time) at time zone v_timezone
    from selected_plans selected
    join public.meal_templates template
      on template.diet_plan_id = selected.id
    on conflict (meal_template_id, local_date) do update
      set scheduled_at = excluded.scheduled_at
      where public.meal_occurrences.status = 'pending'
        and public.meal_occurrences.scheduled_at is distinct from excluded.scheduled_at
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

grant execute on function public.ensure_meal_occurrences_for_date(date) to authenticated;

create or replace function public.ensure_due_meal_occurrences(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  with active_users as (
    select distinct plan.user_id
    from public.diet_plans plan
    join public.pets pet
      on pet.id = plan.pet_id
     and pet.active = true
  ), user_current_dates as (
    select
      active_user.user_id,
      coalesce(preferences.timezone, 'America/Sao_Paulo') as timezone,
      (p_now at time zone coalesce(preferences.timezone, 'America/Sao_Paulo'))::date as local_date
    from active_users active_user
    left join public.user_preferences preferences
      on preferences.user_id = active_user.user_id
  ), user_dates as (
    select user_id, timezone, local_date
    from user_current_dates
    union all
    select user_id, timezone, local_date - 1
    from user_current_dates
  ), selected_plans as (
    select distinct on (plan.pet_id, user_date.local_date)
      plan.id,
      plan.user_id,
      plan.pet_id,
      user_date.timezone,
      user_date.local_date
    from public.diet_plans plan
    join user_dates user_date
      on user_date.user_id = plan.user_id
    join public.pets pet
      on pet.id = plan.pet_id
     and pet.active = true
    where plan.starts_on <= user_date.local_date
      and (plan.ends_on is null or plan.ends_on >= user_date.local_date)
    order by plan.pet_id, user_date.local_date, plan.starts_on desc, plan.created_at desc
  ), inserted as (
    insert into public.meal_occurrences(
      user_id,
      pet_id,
      meal_template_id,
      local_date,
      scheduled_at
    )
    select
      selected.user_id,
      selected.pet_id,
      template.id,
      selected.local_date,
      (selected.local_date + template.scheduled_time) at time zone selected.timezone
    from selected_plans selected
    join public.meal_templates template
      on template.diet_plan_id = selected.id
    on conflict (meal_template_id, local_date) do update
      set scheduled_at = excluded.scheduled_at
      where public.meal_occurrences.status = 'pending'
        and public.meal_occurrences.scheduled_at is distinct from excluded.scheduled_at
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

revoke all on function public.ensure_due_meal_occurrences(timestamptz) from public, anon, authenticated;
grant execute on function public.ensure_due_meal_occurrences(timestamptz) to service_role;

create table if not exists public.meal_notification_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  notification_kind text not null default 'due',
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed', 'skipped')),
  idempotency_key uuid not null default gen_random_uuid(),
  attempt_count integer not null default 1 check (attempt_count > 0),
  onesignal_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheduled_at, notification_kind),
  unique (idempotency_key)
);

create index if not exists meal_notification_groups_user_idx
  on public.meal_notification_groups(user_id, scheduled_at desc);
create index if not exists meal_notification_groups_retry_idx
  on public.meal_notification_groups(status, updated_at)
  where status in ('processing', 'failed');

alter table public.meal_notification_groups enable row level security;
drop policy if exists "Users can view their own notification groups" on public.meal_notification_groups;
create policy "Users can view their own notification groups"
  on public.meal_notification_groups for select to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.meal_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_occurrence_id uuid not null references public.meal_occurrences(id) on delete cascade,
  notification_kind text not null default 'due',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (meal_occurrence_id, notification_kind)
);

alter table public.meal_notification_log
  add column if not exists notification_group_id uuid references public.meal_notification_groups(id) on delete set null;

create index if not exists meal_notification_log_user_idx
  on public.meal_notification_log(user_id, sent_at desc);
create index if not exists meal_notification_log_group_idx
  on public.meal_notification_log(notification_group_id);

alter table public.meal_notification_log enable row level security;
drop policy if exists "Users can view their own notification log" on public.meal_notification_log;
create policy "Users can view their own notification log"
  on public.meal_notification_log for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.claim_meal_notification_group(
  p_user_id uuid,
  p_scheduled_at timestamptz,
  p_notification_kind text default 'due'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group public.meal_notification_groups%rowtype;
begin
  insert into public.meal_notification_groups(
    user_id,
    scheduled_at,
    notification_kind,
    status,
    attempt_count
  )
  values(
    p_user_id,
    p_scheduled_at,
    p_notification_kind,
    'processing',
    1
  )
  on conflict (user_id, scheduled_at, notification_kind) do nothing
  returning * into v_group;

  if found then
    return to_jsonb(v_group);
  end if;

  update public.meal_notification_groups
  set status = 'processing',
      attempt_count = attempt_count + 1,
      last_error = null,
      updated_at = now()
  where user_id = p_user_id
    and scheduled_at = p_scheduled_at
    and notification_kind = p_notification_kind
    and attempt_count < 5
    and (
      (status = 'failed' and updated_at <= now() - interval '30 seconds')
      or
      (status = 'processing' and updated_at <= now() - interval '2 minutes')
    )
  returning * into v_group;

  if found then
    return to_jsonb(v_group);
  end if;

  return null;
end;
$$;

revoke all on function public.claim_meal_notification_group(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_meal_notification_group(uuid, timestamptz, text) to service_role;

create or replace function public.complete_meal_notification_group(
  p_group_id uuid,
  p_status text,
  p_message_id text,
  p_occurrence_ids uuid[],
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_notification_kind text;
begin
  if p_status not in ('sent', 'skipped') then
    raise exception 'Status final inválido';
  end if;

  update public.meal_notification_groups
  set status = p_status,
      onesignal_message_id = nullif(p_message_id, ''),
      last_error = case when p_status = 'skipped' then left(p_note, 2000) else null end,
      sent_at = now(),
      updated_at = now()
  where id = p_group_id
  returning user_id, notification_kind into v_user_id, v_notification_kind;

  if not found then
    raise exception 'Grupo de notificação não encontrado';
  end if;

  insert into public.meal_notification_log(
    user_id,
    meal_occurrence_id,
    notification_kind,
    notification_group_id,
    sent_at
  )
  select
    v_user_id,
    occurrence.id,
    v_notification_kind,
    p_group_id,
    now()
  from public.meal_occurrences occurrence
  where occurrence.id = any(p_occurrence_ids)
    and occurrence.user_id = v_user_id
  on conflict (meal_occurrence_id, notification_kind) do update
    set notification_group_id = excluded.notification_group_id;
end;
$$;

revoke all on function public.complete_meal_notification_group(uuid, text, text, uuid[], text) from public, anon, authenticated;
grant execute on function public.complete_meal_notification_group(uuid, text, text, uuid[], text) to service_role;

create or replace function public.fail_meal_notification_group(
  p_group_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.meal_notification_groups
  set status = 'failed',
      last_error = left(coalesce(p_error, 'Falha desconhecida'), 2000),
      updated_at = now()
  where id = p_group_id
    and status = 'processing';
end;
$$;

revoke all on function public.fail_meal_notification_group(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_meal_notification_group(uuid, text) to service_role;
