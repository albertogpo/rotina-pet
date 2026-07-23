-- Rotina Pet v0.6.2
-- Reconcilia as ocorrências quando um plano é substituído ou quando seus horários mudam.
-- Regras:
--   1. ocorrências pendentes a partir da vigência são substituídas;
--   2. ocorrências concluídas ou não servidas permanecem como histórico;
--   3. uma refeição já registrada impede a criação de outra pendente para a mesma sequência.

create or replace function public.save_diet_plan(
  p_pet_id uuid,
  p_name text,
  p_starts_on date,
  p_meal_times text[],
  p_foods jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan uuid;
  v_time text;
  v_sequence integer := 0;
  v_food jsonb;
  v_meal_sequence integer;
  v_selected_count integer;
  v_base numeric(10,3);
  v_quantity numeric(10,3);
  v_template uuid;
  v_last_sequence integer;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.pets
    where id = p_pet_id
      and user_id = v_user
      and active
  ) then
    raise exception 'Animal não encontrado';
  end if;

  if coalesce(array_length(p_meal_times, 1), 0) = 0 then
    raise exception 'Informe os horários';
  end if;

  if jsonb_array_length(p_foods) = 0 then
    raise exception 'Informe ao menos um alimento';
  end if;

  -- O novo plano substitui somente ocorrências ainda não registradas.
  -- Concluídas e não servidas são preservadas para o histórico.
  delete from public.meal_occurrences
  where user_id = v_user
    and pet_id = p_pet_id
    and local_date >= p_starts_on
    and status = 'pending';

  update public.diet_plans
  set active = false,
      ends_on = case
        when starts_on < p_starts_on then p_starts_on - 1
        else starts_on
      end
  where pet_id = p_pet_id
    and user_id = v_user
    and active = true;

  insert into public.diet_plans(user_id, pet_id, name, starts_on, active)
  values(
    v_user,
    p_pet_id,
    coalesce(nullif(trim(p_name), ''), 'Plano alimentar'),
    p_starts_on,
    true
  )
  returning id into v_plan;

  foreach v_time in array p_meal_times loop
    v_sequence := v_sequence + 1;

    insert into public.meal_templates(
      user_id,
      diet_plan_id,
      scheduled_time,
      sequence
    )
    values(v_user, v_plan, v_time::time, v_sequence);
  end loop;

  for v_food in
    select * from jsonb_array_elements(p_foods)
  loop
    v_selected_count := jsonb_array_length(v_food -> 'meal_sequences');

    if v_selected_count < 1 then
      raise exception 'Selecione ao menos uma refeição para cada alimento';
    end if;

    insert into public.plan_foods(
      user_id,
      diet_plan_id,
      food_id,
      daily_quantity,
      unit,
      meal_sequences
    )
    values(
      v_user,
      v_plan,
      (v_food ->> 'food_id')::uuid,
      (v_food ->> 'daily_quantity')::numeric,
      v_food ->> 'unit',
      array(
        select jsonb_array_elements_text(v_food -> 'meal_sequences')::integer
      )
    );

    v_base := round(
      (v_food ->> 'daily_quantity')::numeric / v_selected_count,
      3
    );

    select max(value::integer)
    into v_last_sequence
    from jsonb_array_elements_text(v_food -> 'meal_sequences');

    for v_meal_sequence in
      select jsonb_array_elements_text(v_food -> 'meal_sequences')::integer
    loop
      select id
      into v_template
      from public.meal_templates
      where diet_plan_id = v_plan
        and sequence = v_meal_sequence;

      if v_template is null then
        raise exception 'Refeição inválida';
      end if;

      if v_meal_sequence = v_last_sequence then
        v_quantity :=
          (v_food ->> 'daily_quantity')::numeric
          - v_base * (v_selected_count - 1);
      else
        v_quantity := v_base;
      end if;

      insert into public.meal_components(
        user_id,
        meal_template_id,
        food_id,
        quantity,
        unit
      )
      values(
        v_user,
        v_template,
        (v_food ->> 'food_id')::uuid,
        v_quantity,
        v_food ->> 'unit'
      );
    end loop;
  end loop;

  return v_plan;
end;
$$;

grant execute on function public.save_diet_plan(uuid, text, date, text[], jsonb) to authenticated;

create or replace function public.update_diet_plan_schedule(
  p_plan_id uuid,
  p_starts_on date,
  p_meal_times text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pet_id uuid;
  v_plan_name text;
  v_old_starts_on date;
  v_old_template_count integer;
  v_new_plan_id uuid;
  v_time text;
  v_sequence integer := 0;
  v_template_id uuid;
  v_food record;
  v_selected_count integer;
  v_base numeric;
  v_last_sequence integer;
  v_meal_sequence integer;
  v_quantity numeric;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if coalesce(array_length(p_meal_times, 1), 0) < 1 then
    raise exception 'Informe ao menos um horário';
  end if;

  if exists (
    select 1
    from unnest(p_meal_times) as meal_time(value)
    group by value
    having count(*) > 1
  ) then
    raise exception 'Os horários das refeições não podem se repetir';
  end if;

  select pet_id, name, starts_on
  into v_pet_id, v_plan_name, v_old_starts_on
  from public.diet_plans
  where id = p_plan_id
    and user_id = v_user;

  if not found then
    raise exception 'Plano não encontrado';
  end if;

  if p_starts_on < v_old_starts_on then
    raise exception 'A nova rotina não pode começar antes do plano atual';
  end if;

  select count(*)
  into v_old_template_count
  from public.meal_templates
  where diet_plan_id = p_plan_id;

  if v_old_template_count <> array_length(p_meal_times, 1) then
    raise exception 'A edição de horários precisa manter a quantidade atual de refeições';
  end if;

  -- Remove apenas ocorrências ainda pendentes. Registros feitos pelo tutor
  -- continuam visíveis no histórico, mesmo que pertençam ao horário anterior.
  delete from public.meal_occurrences
  where user_id = v_user
    and pet_id = v_pet_id
    and local_date >= p_starts_on
    and status = 'pending';

  if p_starts_on = v_old_starts_on then
    foreach v_time in array p_meal_times loop
      v_sequence := v_sequence + 1;

      update public.meal_templates
      set scheduled_time = v_time::time
      where diet_plan_id = p_plan_id
        and sequence = v_sequence;
    end loop;

    return p_plan_id;
  end if;

  update public.diet_plans
  set active = false,
      ends_on = p_starts_on - 1
  where id = p_plan_id
    and user_id = v_user;

  insert into public.diet_plans(user_id, pet_id, name, starts_on, active)
  values(v_user, v_pet_id, v_plan_name, p_starts_on, true)
  returning id into v_new_plan_id;

  v_sequence := 0;

  foreach v_time in array p_meal_times loop
    v_sequence := v_sequence + 1;

    insert into public.meal_templates(
      user_id,
      diet_plan_id,
      scheduled_time,
      sequence
    )
    values(v_user, v_new_plan_id, v_time::time, v_sequence);
  end loop;

  for v_food in
    select food_id, daily_quantity, unit, meal_sequences
    from public.plan_foods
    where diet_plan_id = p_plan_id
  loop
    v_selected_count := cardinality(v_food.meal_sequences);

    if v_selected_count < 1 then
      raise exception 'O plano possui um alimento sem refeição selecionada';
    end if;

    if exists (
      select 1
      from unnest(v_food.meal_sequences) as selected(sequence_number)
      where sequence_number > array_length(p_meal_times, 1)
    ) then
      raise exception 'A distribuição dos alimentos não é compatível com os novos horários';
    end if;

    insert into public.plan_foods(
      user_id,
      diet_plan_id,
      food_id,
      daily_quantity,
      unit,
      meal_sequences
    )
    values(
      v_user,
      v_new_plan_id,
      v_food.food_id,
      v_food.daily_quantity,
      v_food.unit,
      v_food.meal_sequences
    );

    v_base := round(v_food.daily_quantity / v_selected_count, 3);

    select max(sequence_number)
    into v_last_sequence
    from unnest(v_food.meal_sequences) as selected(sequence_number);

    foreach v_meal_sequence in array v_food.meal_sequences loop
      select id
      into v_template_id
      from public.meal_templates
      where diet_plan_id = v_new_plan_id
        and sequence = v_meal_sequence;

      if v_meal_sequence = v_last_sequence then
        v_quantity :=
          v_food.daily_quantity
          - v_base * (v_selected_count - 1);
      else
        v_quantity := v_base;
      end if;

      insert into public.meal_components(
        user_id,
        meal_template_id,
        food_id,
        quantity,
        unit
      )
      values(
        v_user,
        v_template_id,
        v_food.food_id,
        v_quantity,
        v_food.unit
      );
    end loop;
  end loop;

  return v_new_plan_id;
end;
$$;

grant execute on function public.update_diet_plan_schedule(uuid, date, text[]) to authenticated;

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

  select timezone
  into v_timezone
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
    where not exists (
      select 1
      from public.meal_occurrences registered
      join public.meal_templates registered_template
        on registered_template.id = registered.meal_template_id
      where registered.user_id = selected.user_id
        and registered.pet_id = selected.pet_id
        and registered.local_date = p_local_date
        and registered.status <> 'pending'
        and registered_template.sequence = template.sequence
    )
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
    order by
      plan.pet_id,
      user_date.local_date,
      plan.starts_on desc,
      plan.created_at desc
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
    where not exists (
      select 1
      from public.meal_occurrences registered
      join public.meal_templates registered_template
        on registered_template.id = registered.meal_template_id
      where registered.user_id = selected.user_id
        and registered.pet_id = selected.pet_id
        and registered.local_date = selected.local_date
        and registered.status <> 'pending'
        and registered_template.sequence = template.sequence
    )
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

revoke all on function public.ensure_due_meal_occurrences(timestamptz)
  from public, anon, authenticated;
grant execute on function public.ensure_due_meal_occurrences(timestamptz)
  to service_role;


create or replace function public.reset_meal_occurrence(p_occurrence_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pet_id uuid;
  v_local_date date;
  v_occurrence_plan_id uuid;
  v_selected_plan_id uuid;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  select
    occurrence.pet_id,
    occurrence.local_date,
    template.diet_plan_id
  into
    v_pet_id,
    v_local_date,
    v_occurrence_plan_id
  from public.meal_occurrences occurrence
  join public.meal_templates template
    on template.id = occurrence.meal_template_id
  where occurrence.id = p_occurrence_id
    and occurrence.user_id = v_user;

  if not found then
    raise exception 'Refeição não encontrada';
  end if;

  select plan.id
  into v_selected_plan_id
  from public.diet_plans plan
  where plan.user_id = v_user
    and plan.pet_id = v_pet_id
    and plan.starts_on <= v_local_date
    and (plan.ends_on is null or plan.ends_on >= v_local_date)
  order by plan.starts_on desc, plan.created_at desc
  limit 1;

  if v_selected_plan_id is null
     or v_occurrence_plan_id is distinct from v_selected_plan_id then
    -- O registro pertence a uma versão substituída do plano. Desfazer o
    -- histórico remove essa ocorrência; a rotina vigente será recriada pelo ensure.
    delete from public.meal_occurrences
    where id = p_occurrence_id
      and user_id = v_user;
  else
    update public.meal_occurrences
    set status = 'pending',
        consumption_level = null,
        completed_at = null
    where id = p_occurrence_id
      and user_id = v_user;
  end if;
end;
$$;

grant execute on function public.reset_meal_occurrence(uuid) to authenticated;

-- Limpa ocorrências pendentes inválidas já criadas por versões anteriores.
delete from public.meal_occurrences occurrence
using public.meal_templates template
where occurrence.meal_template_id = template.id
  and occurrence.status = 'pending'
  and template.diet_plan_id is distinct from (
    select candidate.id
    from public.diet_plans candidate
    where candidate.user_id = occurrence.user_id
      and candidate.pet_id = occurrence.pet_id
      and candidate.starts_on <= occurrence.local_date
      and (candidate.ends_on is null or candidate.ends_on >= occurrence.local_date)
    order by candidate.starts_on desc, candidate.created_at desc
    limit 1
  );

-- Se já existe registro concluído ou não servido para a mesma sequência,
-- esse histórico prevalece sobre qualquer ocorrência pendente duplicada.
delete from public.meal_occurrences pending
using public.meal_templates pending_template
where pending.meal_template_id = pending_template.id
  and pending.status = 'pending'
  and exists (
    select 1
    from public.meal_occurrences registered
    join public.meal_templates registered_template
      on registered_template.id = registered.meal_template_id
    where registered.user_id = pending.user_id
      and registered.pet_id = pending.pet_id
      and registered.local_date = pending.local_date
      and registered.status <> 'pending'
      and registered_template.sequence = pending_template.sequence
  );
