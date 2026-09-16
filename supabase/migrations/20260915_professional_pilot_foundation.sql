-- Rotina Pet — Professional Pilot — Etapa 1
-- Fundação aditiva e retrocompatível com a v0.7.7.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Papéis e perfil profissional
-- -----------------------------------------------------------------------------

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('tutor', 'veterinarian')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.professional_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  crmv text,
  crmv_state text,
  credentials text,
  clinic_name text,
  professional_email text,
  professional_phone text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (crmv_state is null or char_length(crmv_state) = 2)
);

-- -----------------------------------------------------------------------------
-- Pequenas extensões em entidades existentes
-- -----------------------------------------------------------------------------

alter table public.pets add column if not exists breed text;

alter table public.weight_entries
  add column if not exists recorded_by uuid references auth.users(id) on delete set null,
  add column if not exists source text;

update public.weight_entries
set recorded_by = coalesce(recorded_by, user_id),
    source = coalesce(source, 'tutor')
where recorded_by is null or source is null;

alter table public.weight_entries
  alter column source set default 'tutor';

alter table public.weight_entries
  drop constraint if exists weight_entries_source_check;
alter table public.weight_entries
  add constraint weight_entries_source_check
  check (source is null or source in ('tutor', 'veterinarian', 'import'));

alter table public.meal_occurrences
  add column if not exists consumption_estimate_ratio numeric(4,3);

alter table public.meal_occurrences
  drop constraint if exists meal_occurrences_consumption_estimate_ratio_check;
alter table public.meal_occurrences
  add constraint meal_occurrences_consumption_estimate_ratio_check
  check (
    consumption_estimate_ratio is null
    or (consumption_estimate_ratio >= 0 and consumption_estimate_ratio <= 1)
  );

update public.meal_occurrences
set consumption_estimate_ratio = case
  when status = 'skipped' then 0.000
  when consumption_level = 'full' then 1.000
  when consumption_level = 'almost' then 0.800
  when consumption_level = 'half' then 0.500
  when consumption_level = 'little' then 0.200
  when consumption_level = 'none' then 0.000
  else null
end
where consumption_estimate_ratio is null;

comment on column public.meal_occurrences.consumption_estimate_ratio is
'Fração estimada ingerida registrada no momento do desfecho. NULL = ingestão desconhecida/sem registro.';


create or replace function public.sync_meal_consumption_estimate_ratio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.consumption_estimate_ratio := case
    when new.status = 'skipped' then 0.000
    when new.status = 'completed' and new.consumption_level = 'full' then 1.000
    when new.status = 'completed' and new.consumption_level = 'almost' then 0.800
    when new.status = 'completed' and new.consumption_level = 'half' then 0.500
    when new.status = 'completed' and new.consumption_level = 'little' then 0.200
    when new.status = 'completed' and new.consumption_level = 'none' then 0.000
    else null
  end;
  return new;
end;
$$;

drop trigger if exists meal_occurrences_sync_consumption_estimate_ratio on public.meal_occurrences;
create trigger meal_occurrences_sync_consumption_estimate_ratio
before insert or update of status, consumption_level
on public.meal_occurrences
for each row
execute function public.sync_meal_consumption_estimate_ratio();

revoke all on function public.sync_meal_consumption_estimate_ratio() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Pacientes, convites e vínculos
-- -----------------------------------------------------------------------------

create table if not exists public.professional_patients (
  id uuid primary key default gen_random_uuid(),
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  tutor_user_id uuid references auth.users(id) on delete set null,
  tutor_email text,
  pet_name text not null check (char_length(trim(pet_name)) between 1 and 60),
  species text not null default 'cat' check (species in ('cat', 'dog')),
  breed text,
  initial_weight_kg numeric(7,3) check (initial_weight_kg is null or initial_weight_kg > 0),
  initial_weight_recorded_at date,
  initial_weight_entry_id uuid references public.weight_entries(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'invited', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists professional_patients_professional_pet_uidx
  on public.professional_patients(professional_user_id, pet_id)
  where pet_id is not null and status <> 'closed';

create unique index if not exists professional_patients_initial_weight_entry_uidx
  on public.professional_patients(initial_weight_entry_id)
  where initial_weight_entry_id is not null;

create table if not exists public.professional_invitations (
  id uuid primary key default gen_random_uuid(),
  professional_patient_id uuid not null references public.professional_patients(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  tutor_email text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists professional_invitations_one_pending_per_patient_uidx
  on public.professional_invitations(professional_patient_id)
  where status = 'pending';

create table if not exists public.professional_relationships (
  id uuid primary key default gen_random_uuid(),
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  tutor_user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  professional_patient_id uuid references public.professional_patients(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.professional_relationships
  drop constraint if exists professional_relationships_professional_user_id_tutor_user_id_pet_id_key;

create unique index if not exists professional_relationships_one_active_uidx
  on public.professional_relationships(professional_user_id, tutor_user_id, pet_id)
  where status = 'active';

create index if not exists professional_relationships_professional_idx
  on public.professional_relationships(professional_user_id, status);
create index if not exists professional_relationships_tutor_idx
  on public.professional_relationships(tutor_user_id, status);
create index if not exists professional_relationships_pet_idx
  on public.professional_relationships(pet_id, status);

-- -----------------------------------------------------------------------------
-- Prescrição nutricional profissional
-- -----------------------------------------------------------------------------

create table if not exists public.nutrition_prescriptions (
  id uuid primary key default gen_random_uuid(),
  professional_patient_id uuid not null references public.professional_patients(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.nutrition_prescription_versions (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.nutrition_prescriptions(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  authored_by uuid not null references auth.users(id) on delete restrict,
  starts_on date not null,
  review_suggested_on date,
  objective text,
  daily_energy_kcal numeric(10,3) check (daily_energy_kcal is null or daily_energy_kcal > 0),
  change_note text,
  created_at timestamptz not null default now(),
  unique (prescription_id, version_number),
  check (review_suggested_on is null or review_suggested_on >= starts_on)
);

create table if not exists public.nutrition_prescription_options (
  id uuid primary key default gen_random_uuid(),
  prescription_version_id uuid not null references public.nutrition_prescription_versions(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (prescription_version_id, sort_order)
);

create unique index if not exists nutrition_prescription_options_one_default_uidx
  on public.nutrition_prescription_options(prescription_version_id)
  where is_default;

create table if not exists public.nutrition_prescription_option_items (
  id uuid primary key default gen_random_uuid(),
  prescription_option_id uuid not null references public.nutrition_prescription_options(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  food_name_snapshot text not null,
  daily_quantity numeric(10,3) not null check (daily_quantity > 0),
  unit text not null check (unit in ('g','ml','sachet','can','scoop','unit')),
  calorie_share_percent numeric(5,2) check (calorie_share_percent is null or (calorie_share_percent >= 0 and calorie_share_percent <= 100)),
  daily_energy_kcal numeric(10,3) check (daily_energy_kcal is null or daily_energy_kcal >= 0),
  instructions text,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (prescription_option_id, sort_order)
);

create table if not exists public.nutrition_prescription_sections (
  id uuid primary key default gen_random_uuid(),
  prescription_version_id uuid not null references public.nutrition_prescription_versions(id) on delete cascade,
  title text not null,
  body text not null,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (prescription_version_id, sort_order)
);

-- Uma rotina usa uma opção profissional por vez; novas rotinas podem ser geradas ao trocar opção.
create table if not exists public.routine_prescription_bindings (
  id uuid primary key default gen_random_uuid(),
  diet_plan_id uuid not null references public.diet_plans(id) on delete cascade,
  prescription_version_id uuid not null references public.nutrition_prescription_versions(id) on delete restrict,
  prescription_option_id uuid not null references public.nutrition_prescription_options(id) on delete restrict,
  activated_by uuid not null references auth.users(id) on delete restrict,
  activated_at timestamptz not null default now(),
  unique (diet_plan_id)
);

-- -----------------------------------------------------------------------------
-- Registro diário e incidentes
-- -----------------------------------------------------------------------------

create table if not exists public.daily_pet_logs (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  tutor_user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, local_date)
);

create table if not exists public.incident_types (
  code text primary key,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 1
);

insert into public.incident_types(code, label, sort_order) values
  ('vomiting', 'Vômito', 10),
  ('regurgitation', 'Regurgitação', 20),
  ('diarrhea', 'Diarreia', 30),
  ('soft_stool', 'Fezes amolecidas', 40),
  ('constipation', 'Constipação', 50),
  ('poor_appetite', 'Falta de apetite', 60),
  ('other', 'Outro', 999)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order;

create table if not exists public.daily_pet_incidents (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references public.daily_pet_logs(id) on delete cascade,
  incident_code text not null references public.incident_types(code),
  notes text,
  created_at timestamptz not null default now(),
  unique (daily_log_id, incident_code)
);

-- -----------------------------------------------------------------------------
-- RLS e funções auxiliares
-- -----------------------------------------------------------------------------

create or replace function public.has_active_professional_relationship(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.professional_relationships relationship
    where relationship.pet_id = p_pet_id
      and relationship.professional_user_id = (select auth.uid())
      and relationship.status = 'active'
  );
$$;

revoke all on function public.has_active_professional_relationship(uuid) from public, anon, authenticated;
grant execute on function public.has_active_professional_relationship(uuid) to authenticated;

create or replace function public.create_professional_invitation(
  p_professional_patient_id uuid,
  p_tutor_email text,
  p_expires_at timestamptz default null
)
returns table (
  invitation_id uuid,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_patient public.professional_patients%rowtype;
  v_email text := lower(btrim(coalesce(p_tutor_email, '')));
  v_token text;
  v_hash text;
  v_expires_at timestamptz := coalesce(p_expires_at, now() + interval '7 days');
  v_invitation_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_email = '' then
    raise exception 'INVITATION_EMAIL_REQUIRED';
  end if;

  if char_length(v_email) > 320
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVITATION_EMAIL_INVALID';
  end if;

  if v_expires_at <= now() then
    raise exception 'INVITATION_EXPIRY_INVALID';
  end if;

  if not exists (
    select 1 from public.user_roles
    where user_id = v_user_id and role = 'veterinarian'
  ) then
    raise exception 'VETERINARIAN_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from public.professional_profiles
    where user_id = v_user_id
  ) then
    raise exception 'PROFESSIONAL_PROFILE_REQUIRED';
  end if;

  select * into v_patient
  from public.professional_patients
  where id = p_professional_patient_id
    and professional_user_id = v_user_id
  for update;

  if not found then
    raise exception 'PROFESSIONAL_PATIENT_NOT_FOUND';
  end if;

  if v_patient.pet_id is not null or v_patient.tutor_user_id is not null or v_patient.status in ('active', 'closed') then
    raise exception 'PROFESSIONAL_PATIENT_NOT_INVITABLE';
  end if;

  update public.professional_invitations
  set status = case
    when expires_at is not null and expires_at <= now() then 'expired'
    else 'revoked'
  end
  where professional_patient_id = v_patient.id
    and status = 'pending';

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.professional_invitations (
    professional_patient_id,
    professional_user_id,
    tutor_email,
    token_hash,
    expires_at
  ) values (
    v_patient.id,
    v_user_id,
    v_email,
    v_hash,
    v_expires_at
  ) returning id into v_invitation_id;

  update public.professional_patients
  set tutor_email = v_email,
      status = 'invited',
      updated_at = now()
  where id = v_patient.id;

  return query select v_invitation_id, v_token, v_expires_at;
end;
$$;

revoke all on function public.create_professional_invitation(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_professional_invitation(uuid, text, timestamptz) to authenticated;

create or replace function public.get_professional_invitation_preview(p_token text)
returns table (
  invitation_id uuid,
  professional_patient_id uuid,
  pet_name text,
  species text,
  breed text,
  professional_name text,
  clinic_name text,
  expires_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    invitation.id,
    patient.id,
    patient.pet_name,
    patient.species,
    patient.breed,
    profile.display_name,
    profile.clinic_name,
    invitation.expires_at,
    case
      when invitation.status = 'pending'
        and invitation.expires_at is not null
        and invitation.expires_at <= now()
      then 'expired'
      else invitation.status
    end as status
  from public.professional_invitations invitation
  join public.professional_patients patient on patient.id = invitation.professional_patient_id
  join public.professional_profiles profile on profile.user_id = invitation.professional_user_id
  where invitation.token_hash = encode(digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex')
  limit 1;
$$;

revoke all on function public.get_professional_invitation_preview(text) from public, anon, authenticated;
grant execute on function public.get_professional_invitation_preview(text) to anon, authenticated;

create or replace function public.accept_professional_invitation(
  p_token text,
  p_existing_pet_id uuid default null
)
returns table (
  invitation_id uuid,
  professional_patient_id uuid,
  pet_id uuid,
  relationship_id uuid,
  initial_weight_entry_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_hash text := encode(digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex');
  v_invitation public.professional_invitations%rowtype;
  v_patient public.professional_patients%rowtype;
  v_pet public.pets%rowtype;
  v_pet_id uuid;
  v_relationship_id uuid;
  v_weight_entry_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select lower(btrim(email)) into v_user_email
  from auth.users
  where id = v_user_id;

  if coalesce(v_user_email, '') = '' then
    raise exception 'AUTH_EMAIL_REQUIRED';
  end if;

  -- Lock order is always patient -> invitation. create_professional_invitation uses
  -- the same order, avoiding a deadlock if a tutor accepts while the professional
  -- regenerates the link at the same time.
  select * into v_invitation
  from public.professional_invitations
  where token_hash = v_hash;

  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  select * into v_patient
  from public.professional_patients
  where id = v_invitation.professional_patient_id
  for update;

  if not found then
    raise exception 'PROFESSIONAL_PATIENT_NOT_FOUND';
  end if;

  select * into v_invitation
  from public.professional_invitations
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  if v_patient.professional_user_id is distinct from v_invitation.professional_user_id then
    raise exception 'PROFESSIONAL_PATIENT_NOT_FOUND';
  end if;

  if v_invitation.status = 'accepted' then
    if v_invitation.accepted_by is distinct from v_user_id then
      raise exception 'INVITATION_ALREADY_ACCEPTED';
    end if;

    select relationship.id into v_relationship_id
    from public.professional_relationships relationship
    where relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.tutor_user_id = v_user_id
      and relationship.pet_id = v_patient.pet_id
    order by (relationship.status = 'active') desc, relationship.created_at desc
    limit 1;

    return query select
      v_invitation.id,
      v_patient.id,
      v_patient.pet_id,
      v_relationship_id,
      v_patient.initial_weight_entry_id;
    return;
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'INVITATION_NOT_PENDING';
  end if;

  if v_invitation.expires_at is not null and v_invitation.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED';
  end if;

  if lower(btrim(v_invitation.tutor_email)) <> v_user_email then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  if v_patient.status = 'closed' then
    raise exception 'PROFESSIONAL_PATIENT_CLOSED';
  end if;

  if v_patient.pet_id is not null or v_patient.tutor_user_id is not null then
    raise exception 'PROFESSIONAL_PATIENT_ALREADY_LINKED';
  end if;

  if p_existing_pet_id is not null then
    select * into v_pet
    from public.pets
    where id = p_existing_pet_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception 'PET_NOT_OWNED_BY_TUTOR';
    end if;

    if not v_pet.active then
      raise exception 'PET_NOT_ACTIVE';
    end if;

    if v_pet.species <> v_patient.species then
      raise exception 'PET_SPECIES_MISMATCH';
    end if;

    if nullif(btrim(v_pet.breed), '') is null and nullif(btrim(v_patient.breed), '') is not null then
      update public.pets
      set breed = btrim(v_patient.breed)
      where id = v_pet.id;
    end if;

    v_pet_id := v_pet.id;
  else
    insert into public.pets (user_id, name, species, icon, breed)
    values (
      v_user_id,
      btrim(v_patient.pet_name),
      v_patient.species,
      case when v_patient.species = 'dog' then '🐶' else '🐈' end,
      nullif(btrim(v_patient.breed), '')
    ) returning id into v_pet_id;
  end if;

  if exists (
    select 1 from public.professional_patients other_patient
    where other_patient.professional_user_id = v_invitation.professional_user_id
      and other_patient.pet_id = v_pet_id
      and other_patient.id <> v_patient.id
      and other_patient.status <> 'closed'
  ) then
    raise exception 'PET_ALREADY_LINKED_TO_PROFESSIONAL';
  end if;

  v_weight_entry_id := v_patient.initial_weight_entry_id;
  if v_patient.initial_weight_kg is not null and v_weight_entry_id is null then
    insert into public.weight_entries (
      user_id,
      pet_id,
      recorded_at,
      weight_kg,
      notes,
      recorded_by,
      source
    ) values (
      v_user_id,
      v_pet_id,
      coalesce(v_patient.initial_weight_recorded_at, v_patient.created_at::date),
      v_patient.initial_weight_kg,
      'Peso inicial informado no cadastro profissional.',
      v_invitation.professional_user_id,
      'veterinarian'
    ) returning id into v_weight_entry_id;
  end if;

  update public.professional_patients
  set pet_id = v_pet_id,
      tutor_user_id = v_user_id,
      tutor_email = lower(btrim(v_invitation.tutor_email)),
      initial_weight_entry_id = v_weight_entry_id,
      status = 'active',
      updated_at = now()
  where id = v_patient.id;

  select relationship.id into v_relationship_id
  from public.professional_relationships relationship
  where relationship.professional_user_id = v_invitation.professional_user_id
    and relationship.tutor_user_id = v_user_id
    and relationship.pet_id = v_pet_id
    and relationship.status = 'active'
  limit 1
  for update;

  if v_relationship_id is null then
    insert into public.professional_relationships (
      professional_user_id,
      tutor_user_id,
      pet_id,
      professional_patient_id,
      status
    ) values (
      v_invitation.professional_user_id,
      v_user_id,
      v_pet_id,
      v_patient.id,
      'active'
    ) returning id into v_relationship_id;
  elsif not exists (
    select 1 from public.professional_relationships
    where id = v_relationship_id and professional_patient_id = v_patient.id
  ) then
    raise exception 'ACTIVE_RELATIONSHIP_CONFLICT';
  end if;

  update public.professional_invitations
  set status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now()
  where id = v_invitation.id;

  return query select
    v_invitation.id,
    v_patient.id,
    v_pet_id,
    v_relationship_id,
    v_weight_entry_id;
end;
$$;

revoke all on function public.accept_professional_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_professional_invitation(text, uuid) to authenticated;

alter table public.user_roles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.professional_patients enable row level security;
alter table public.professional_invitations enable row level security;
alter table public.professional_relationships enable row level security;
alter table public.nutrition_prescriptions enable row level security;
alter table public.nutrition_prescription_versions enable row level security;
alter table public.nutrition_prescription_options enable row level security;
alter table public.nutrition_prescription_option_items enable row level security;
alter table public.nutrition_prescription_sections enable row level security;
alter table public.routine_prescription_bindings enable row level security;
alter table public.daily_pet_logs enable row level security;
alter table public.incident_types enable row level security;
alter table public.daily_pet_incidents enable row level security;

-- Privilégios explícitos do Data API. O preview público passa exclusivamente pela
-- RPC get_professional_invitation_preview; anon não acessa tabelas profissionais.
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.professional_profiles from anon, authenticated;
revoke all on table public.professional_patients from anon, authenticated;
revoke all on table public.professional_invitations from anon, authenticated;
revoke all on table public.professional_relationships from anon, authenticated;
revoke all on table public.nutrition_prescriptions from anon, authenticated;
revoke all on table public.nutrition_prescription_versions from anon, authenticated;
revoke all on table public.nutrition_prescription_options from anon, authenticated;
revoke all on table public.nutrition_prescription_option_items from anon, authenticated;
revoke all on table public.nutrition_prescription_sections from anon, authenticated;
revoke all on table public.routine_prescription_bindings from anon, authenticated;
revoke all on table public.daily_pet_logs from anon, authenticated;
revoke all on table public.incident_types from anon, authenticated;
revoke all on table public.daily_pet_incidents from anon, authenticated;

grant select, insert, update, delete on table public.user_roles to authenticated;
grant select, insert, update on table public.professional_profiles to authenticated;
grant select, insert, update, delete on table public.professional_patients to authenticated;
grant select on table public.professional_invitations to authenticated;
grant select on table public.professional_relationships to authenticated;
grant select, insert, update, delete on table public.nutrition_prescriptions to authenticated;
grant select, insert, update, delete on table public.nutrition_prescription_versions to authenticated;
grant select, insert, update, delete on table public.nutrition_prescription_options to authenticated;
grant select, insert, update, delete on table public.nutrition_prescription_option_items to authenticated;
grant select, insert, update, delete on table public.nutrition_prescription_sections to authenticated;
grant select, insert, update, delete on table public.routine_prescription_bindings to authenticated;
grant select, insert, update, delete on table public.daily_pet_logs to authenticated;
grant select on table public.incident_types to authenticated;
grant select, insert, update, delete on table public.daily_pet_incidents to authenticated;

-- Papéis e perfil: o próprio usuário gerencia.
drop policy if exists "Own roles" on public.user_roles;
create policy "Own roles" on public.user_roles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Own professional profile" on public.professional_profiles;
create policy "Own professional profile" on public.professional_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Catálogo de incidentes é legível por usuários autenticados.
drop policy if exists "Authenticated can read incident types" on public.incident_types;
create policy "Authenticated can read incident types" on public.incident_types
  for select to authenticated using (true);

-- Caso profissional: o frontend só manipula o estado preliminar.
-- A materialização (pet/tutor/active) ocorre exclusivamente no RPC de aceite.
drop policy if exists "Professional manages own patients" on public.professional_patients;
drop policy if exists "Professional reads own patients" on public.professional_patients;
create policy "Professional reads own patients" on public.professional_patients
  for select to authenticated
  using ((select auth.uid()) = professional_user_id);

drop policy if exists "Professional creates preliminary patients" on public.professional_patients;
create policy "Professional creates preliminary patients" on public.professional_patients
  for insert to authenticated
  with check (
    (select auth.uid()) = professional_user_id
    and pet_id is null
    and tutor_user_id is null
    and initial_weight_entry_id is null
    and status = 'draft'
    and exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'veterinarian'
    )
  );

drop policy if exists "Professional updates preliminary patients" on public.professional_patients;
create policy "Professional updates preliminary patients" on public.professional_patients
  for update to authenticated
  using (
    (select auth.uid()) = professional_user_id
    and pet_id is null
    and tutor_user_id is null
    and status in ('draft', 'invited')
  )
  with check (
    (select auth.uid()) = professional_user_id
    and pet_id is null
    and tutor_user_id is null
    and initial_weight_entry_id is null
    and status in ('draft', 'invited')
  );

drop policy if exists "Professional deletes preliminary patients" on public.professional_patients;
create policy "Professional deletes preliminary patients" on public.professional_patients
  for delete to authenticated
  using (
    (select auth.uid()) = professional_user_id
    and pet_id is null
    and tutor_user_id is null
    and status in ('draft', 'invited')
  );

drop policy if exists "Tutor reads linked professional patients" on public.professional_patients;
create policy "Tutor reads linked professional patients" on public.professional_patients
  for select to authenticated
  using ((select auth.uid()) = tutor_user_id);

-- Relações ativas são fronteira de autorização: frontend apenas lê.
drop policy if exists "Relationship parties can read" on public.professional_relationships;
create policy "Relationship parties can read" on public.professional_relationships
  for select to authenticated
  using ((select auth.uid()) in (professional_user_id, tutor_user_id));

drop policy if exists "Professional can create relationships" on public.professional_relationships;
drop policy if exists "Professional can update relationships" on public.professional_relationships;

-- Convites são criados/aceitos por RPC; o profissional pode apenas consultar os seus.
drop policy if exists "Professional manages invitations" on public.professional_invitations;
drop policy if exists "Professional reads invitations" on public.professional_invitations;
create policy "Professional reads invitations" on public.professional_invitations
  for select to authenticated
  using ((select auth.uid()) = professional_user_id);

-- Prescrições e filhos: profissional autor gerencia; tutor do caso pode ler.
drop policy if exists "Professional manages prescriptions" on public.nutrition_prescriptions;
create policy "Professional manages prescriptions" on public.nutrition_prescriptions
  for all to authenticated
  using (
    (select auth.uid()) = professional_user_id
    and exists (
      select 1 from public.professional_patients patient
      where patient.id = professional_patient_id
        and patient.professional_user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = professional_user_id
    and exists (
      select 1 from public.professional_patients patient
      where patient.id = professional_patient_id
        and patient.professional_user_id = (select auth.uid())
        and (pet_id is null or pet_id = patient.pet_id)
    )
  );

drop policy if exists "Tutor reads prescriptions" on public.nutrition_prescriptions;
create policy "Tutor reads prescriptions" on public.nutrition_prescriptions
  for select to authenticated
  using (
    exists (
      select 1 from public.professional_patients patient
      where patient.id = professional_patient_id
        and patient.tutor_user_id = (select auth.uid())
    )
  );

-- Child prescription tables inherit authorization through parent joins.
drop policy if exists "Prescription parties read versions" on public.nutrition_prescription_versions;
create policy "Prescription parties read versions" on public.nutrition_prescription_versions
  for select to authenticated
  using (
    exists (
      select 1
      from public.nutrition_prescriptions p
      join public.professional_patients patient on patient.id = p.professional_patient_id
      where p.id = prescription_id
        and ((select auth.uid()) = p.professional_user_id or (select auth.uid()) = patient.tutor_user_id)
    )
  );

drop policy if exists "Professional manages versions" on public.nutrition_prescription_versions;
create policy "Professional manages versions" on public.nutrition_prescription_versions
  for all to authenticated
  using (
    exists (select 1 from public.nutrition_prescriptions p where p.id = prescription_id and p.professional_user_id = (select auth.uid()))
  )
  with check (
    authored_by = (select auth.uid())
    and exists (select 1 from public.nutrition_prescriptions p where p.id = prescription_id and p.professional_user_id = (select auth.uid()))
  );

-- Options/items/sections: policies baseadas na versão/prescrição.
drop policy if exists "Prescription parties read options" on public.nutrition_prescription_options;
create policy "Prescription parties read options" on public.nutrition_prescription_options
  for select to authenticated
  using (
    exists (
      select 1 from public.nutrition_prescription_versions v
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      join public.professional_patients patient on patient.id = p.professional_patient_id
      where v.id = prescription_version_id
        and ((select auth.uid()) = p.professional_user_id or (select auth.uid()) = patient.tutor_user_id)
    )
  );

drop policy if exists "Professional manages options" on public.nutrition_prescription_options;
create policy "Professional manages options" on public.nutrition_prescription_options
  for all to authenticated
  using (
    exists (
      select 1 from public.nutrition_prescription_versions v
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      where v.id = prescription_version_id and p.professional_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.nutrition_prescription_versions v
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      where v.id = prescription_version_id and p.professional_user_id = (select auth.uid())
    )
  );

drop policy if exists "Prescription parties read option items" on public.nutrition_prescription_option_items;
create policy "Prescription parties read option items" on public.nutrition_prescription_option_items
  for select to authenticated
  using (
    exists (
      select 1 from public.nutrition_prescription_options o
      join public.nutrition_prescription_versions v on v.id = o.prescription_version_id
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      join public.professional_patients patient on patient.id = p.professional_patient_id
      where o.id = prescription_option_id
        and ((select auth.uid()) = p.professional_user_id or (select auth.uid()) = patient.tutor_user_id)
    )
  );

drop policy if exists "Professional manages option items" on public.nutrition_prescription_option_items;
create policy "Professional manages option items" on public.nutrition_prescription_option_items
  for all to authenticated
  using (
    exists (
      select 1 from public.nutrition_prescription_options o
      join public.nutrition_prescription_versions v on v.id = o.prescription_version_id
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      where o.id = prescription_option_id and p.professional_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.nutrition_prescription_options o
      join public.nutrition_prescription_versions v on v.id = o.prescription_version_id
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      where o.id = prescription_option_id and p.professional_user_id = (select auth.uid())
    )
  );

drop policy if exists "Prescription parties read sections" on public.nutrition_prescription_sections;
create policy "Prescription parties read sections" on public.nutrition_prescription_sections
  for select to authenticated
  using (
    exists (
      select 1 from public.nutrition_prescription_versions v
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      join public.professional_patients patient on patient.id = p.professional_patient_id
      where v.id = prescription_version_id
        and ((select auth.uid()) = p.professional_user_id or (select auth.uid()) = patient.tutor_user_id)
    )
  );

drop policy if exists "Professional manages sections" on public.nutrition_prescription_sections;
create policy "Professional manages sections" on public.nutrition_prescription_sections
  for all to authenticated
  using (
    exists (
      select 1 from public.nutrition_prescription_versions v
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      where v.id = prescription_version_id and p.professional_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.nutrition_prescription_versions v
      join public.nutrition_prescriptions p on p.id = v.prescription_id
      where v.id = prescription_version_id and p.professional_user_id = (select auth.uid())
    )
  );

-- Bindings são visíveis a quem possui a rotina e ao profissional responsável pela prescrição.
drop policy if exists "Routine owner manages bindings" on public.routine_prescription_bindings;
create policy "Routine owner manages bindings" on public.routine_prescription_bindings
  for all to authenticated
  using (
    exists (select 1 from public.diet_plans d where d.id = diet_plan_id and d.user_id = (select auth.uid()))
  )
  with check (
    activated_by = (select auth.uid())
    and exists (select 1 from public.diet_plans d where d.id = diet_plan_id and d.user_id = (select auth.uid()))
  );

-- Diário: tutor escreve; profissional vinculado lê.
drop policy if exists "Tutor manages daily logs" on public.daily_pet_logs;
create policy "Tutor manages daily logs" on public.daily_pet_logs
  for all to authenticated
  using ((select auth.uid()) = tutor_user_id)
  with check ((select auth.uid()) = tutor_user_id and created_by = (select auth.uid()));

drop policy if exists "Professional reads linked daily logs" on public.daily_pet_logs;
create policy "Professional reads linked daily logs" on public.daily_pet_logs
  for select to authenticated
  using (public.has_active_professional_relationship(pet_id));

drop policy if exists "Tutor manages daily incidents" on public.daily_pet_incidents;
create policy "Tutor manages daily incidents" on public.daily_pet_incidents
  for all to authenticated
  using (
    exists (select 1 from public.daily_pet_logs l where l.id = daily_log_id and l.tutor_user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.daily_pet_logs l where l.id = daily_log_id and l.tutor_user_id = (select auth.uid()))
  );

drop policy if exists "Professional reads linked daily incidents" on public.daily_pet_incidents;
create policy "Professional reads linked daily incidents" on public.daily_pet_incidents
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_pet_logs l
      where l.id = daily_log_id
        and public.has_active_professional_relationship(l.pet_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Acesso profissional ao peso (mantendo as políticas legadas de proprietário)
-- -----------------------------------------------------------------------------

drop policy if exists "Professional reads linked weights" on public.weight_entries;
create policy "Professional reads linked weights" on public.weight_entries
  for select to authenticated
  using (public.has_active_professional_relationship(pet_id));

drop policy if exists "Professional inserts linked weights" on public.weight_entries;
create policy "Professional inserts linked weights" on public.weight_entries
  for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and source = 'veterinarian'
    and public.has_active_professional_relationship(pet_id)
    and exists (select 1 from public.pets p where p.id = pet_id and p.user_id = user_id)
  );

-- O profissional pode ver o cadastro básico do pet vinculado, mas não editar a posse.
drop policy if exists "Professional reads linked pets" on public.pets;
create policy "Professional reads linked pets" on public.pets
  for select to authenticated
  using (public.has_active_professional_relationship(id));

-- O profissional pode ler rotina e ocorrências do pet vinculado; escrita continua com o tutor.
drop policy if exists "Professional reads linked meal occurrences" on public.meal_occurrences;
create policy "Professional reads linked meal occurrences" on public.meal_occurrences
  for select to authenticated
  using (public.has_active_professional_relationship(pet_id));

-- -----------------------------------------------------------------------------
-- Função de cálculo básico de ingestão diária por pet/alimento.
-- Mantém % sobre o total prescrito mesmo quando há ocorrências pendentes.
-- -----------------------------------------------------------------------------

create or replace function public.get_daily_intake_summary(p_pet_id uuid, p_local_date date)
returns table (
  food_id uuid,
  food_name text,
  unit text,
  prescribed_quantity numeric,
  estimated_consumed_quantity numeric,
  estimated_consumed_percent numeric,
  total_occurrences integer,
  registered_occurrences integer,
  missing_occurrences integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with occurrence_items as (
    select
      occurrence.id as occurrence_id,
      occurrence.status,
      occurrence.consumption_estimate_ratio,
      component.food_id,
      food.name as food_name,
      component.unit,
      component.quantity
    from public.meal_occurrences occurrence
    join public.meal_templates template on template.id = occurrence.meal_template_id
    join public.meal_components component on component.meal_template_id = template.id
    join public.foods food on food.id = component.food_id
    where occurrence.pet_id = p_pet_id
      and occurrence.local_date = p_local_date
  )
  select
    food_id,
    max(food_name) as food_name,
    unit,
    sum(quantity) as prescribed_quantity,
    round(sum(case when consumption_estimate_ratio is null then 0 else quantity * consumption_estimate_ratio end), 3) as estimated_consumed_quantity,
    case
      when sum(quantity) = 0 then 0
      else round(
        100 * sum(case when consumption_estimate_ratio is null then 0 else quantity * consumption_estimate_ratio end) / sum(quantity),
        1
      )
    end as estimated_consumed_percent,
    count(distinct occurrence_id)::integer as total_occurrences,
    count(distinct occurrence_id) filter (where consumption_estimate_ratio is not null)::integer as registered_occurrences,
    count(distinct occurrence_id) filter (where consumption_estimate_ratio is null)::integer as missing_occurrences
  from occurrence_items
  group by food_id, unit
  order by max(food_name);
$$;

revoke all on function public.get_daily_intake_summary(uuid, date) from public, anon, authenticated;
grant execute on function public.get_daily_intake_summary(uuid, date) to authenticated;

