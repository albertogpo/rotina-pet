-- Rotina Pet v0.4.0
-- Adiciona o nível aproximado de consumo às ocorrências de refeição.
-- Seguro para executar mais de uma vez.

alter table public.meal_occurrences
  add column if not exists consumption_level text;

alter table public.meal_occurrences
  drop constraint if exists meal_occurrences_consumption_level_check;

alter table public.meal_occurrences
  add constraint meal_occurrences_consumption_level_check
  check (
    consumption_level is null
    or consumption_level in ('full','almost','half','little','none')
  );

-- Registros concluídos antes desta atualização equivaliam à ação "Comeu tudo".
update public.meal_occurrences
set consumption_level = 'full'
where status = 'completed'
  and consumption_level is null;

-- Estados pendentes ou não servidos não devem carregar nível de consumo.
update public.meal_occurrences
set consumption_level = null
where status in ('pending','skipped')
  and consumption_level is not null;

comment on column public.meal_occurrences.consumption_level is
  'Consumo aproximado registrado pelo tutor: full, almost, half, little ou none.';
