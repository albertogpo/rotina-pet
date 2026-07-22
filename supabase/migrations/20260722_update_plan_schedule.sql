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

  if exists (
    select 1
    from public.meal_occurrences occurrence
    join public.meal_templates template
      on template.id = occurrence.meal_template_id
    where template.diet_plan_id = p_plan_id
      and occurrence.local_date >= p_starts_on
      and occurrence.status <> 'pending'
  ) then
    raise exception 'Já existem refeições registradas a partir dessa data. Escolha uma data posterior';
  end if;

  delete from public.meal_occurrences occurrence
  using public.meal_templates template
  where occurrence.meal_template_id = template.id
    and template.diet_plan_id = p_plan_id
    and occurrence.local_date >= p_starts_on
    and occurrence.status = 'pending';

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
    insert into public.meal_templates(user_id, diet_plan_id, scheduled_time, sequence)
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
        v_quantity := v_food.daily_quantity - v_base * (v_selected_count - 1);
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
