-- Wave 1 / v0.8.1 — Block 5
-- Canonical final definition for duplicate professional-patient resolution.


alter table public.professional_patients
  add column if not exists closed_reason text,
  add column if not exists duplicate_of_patient_id uuid;


alter table public.professional_patients
  drop constraint if exists professional_patients_duplicate_of_patient_id_fkey;
alter table public.professional_patients
  add constraint professional_patients_duplicate_of_patient_id_fkey
  foreign key (duplicate_of_patient_id)
  references public.professional_patients(id)
  on delete restrict;


alter table public.professional_patients
  drop constraint if exists professional_patients_duplicate_not_self_check;
alter table public.professional_patients
  add constraint professional_patients_duplicate_not_self_check
  check (duplicate_of_patient_id is null or duplicate_of_patient_id <> id);


alter table public.professional_patients
  drop constraint if exists professional_patients_duplicate_resolution_check;
alter table public.professional_patients
  add constraint professional_patients_duplicate_resolution_check
  check (
    (closed_reason is null and duplicate_of_patient_id is null)
    or
    (status = 'closed' and closed_reason = 'duplicate' and duplicate_of_patient_id is not null)
  );


alter table public.professional_invitations
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz;


alter table public.professional_invitations
  drop constraint if exists professional_invitations_status_check;
alter table public.professional_invitations
  add constraint professional_invitations_status_check
  check (status in ('pending','accepted','resolved','expired','revoked'));


alter table public.professional_invitations
  drop constraint if exists professional_invitations_resolution_lifecycle_check;
alter table public.professional_invitations
  add constraint professional_invitations_resolution_lifecycle_check
  check (
    (status='accepted' and accepted_by is not null and accepted_at is not null and resolved_by is null and resolved_at is null)
    or
    (status='resolved' and resolved_by is not null and resolved_at is not null and accepted_by is null and accepted_at is null)
    or
    (status in ('pending','expired','revoked') and accepted_by is null and accepted_at is null and resolved_by is null and resolved_at is null)
  );


drop function if exists public.accept_professional_invitation(text, uuid);


CREATE OR REPLACE FUNCTION public.accept_professional_invitation(p_token text, p_existing_pet_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(invitation_id uuid, professional_patient_id uuid, pet_id uuid, relationship_id uuid, initial_weight_entry_id uuid, effective_professional_patient_id uuid, resolution text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_hash text := encode(digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex');
  v_invitation public.professional_invitations%rowtype;
  v_patient public.professional_patients%rowtype;
  v_canonical public.professional_patients%rowtype;
  v_pet public.pets%rowtype;
  v_relationship public.professional_relationships%rowtype;
  v_pet_id uuid;
  v_relationship_id uuid;
  v_weight_entry_id uuid;
  v_case_count integer;
  v_active_relationship_count integer;
  v_patient_relationship_count integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;


  select lower(btrim(email))
    into v_user_email
  from auth.users
  where id = v_user_id;


  if coalesce(v_user_email, '') = '' then
    raise exception 'AUTH_EMAIL_REQUIRED';
  end if;


  select *
    into v_invitation
  from public.professional_invitations
  where token_hash = v_hash;


  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;


  -- Established lock order shared with create_professional_invitation:
  -- source patient -> invitation.
  select *
    into v_patient
  from public.professional_patients
  where id = v_invitation.professional_patient_id
  for update;


  if not found then
    raise exception 'PROFESSIONAL_PATIENT_NOT_FOUND';
  end if;


  select *
    into v_invitation
  from public.professional_invitations
  where token_hash = v_hash
  for update;


  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;


  if v_patient.professional_user_id is distinct from v_invitation.professional_user_id then
    raise exception 'PROFESSIONAL_PATIENT_NOT_FOUND';
  end if;


  -- Retry of an invitation that created a case: resolve the historical
  -- relationship through the original patient, never through a later episode.
  if v_invitation.status = 'accepted' then
    if v_invitation.accepted_by is distinct from v_user_id then
      raise exception 'INVITATION_ALREADY_ACCEPTED';
    end if;


    if v_patient.pet_id is null or v_patient.tutor_user_id is distinct from v_user_id then
      raise exception 'ACCEPTED_INVITATION_INTEGRITY_ERROR';
    end if;


    perform 1
    from public.professional_relationships r
    where r.professional_patient_id = v_patient.id
      and r.professional_user_id = v_invitation.professional_user_id
      and r.tutor_user_id = v_user_id
      and r.pet_id = v_patient.pet_id
    for update;


    select count(*)
      into v_patient_relationship_count
    from public.professional_relationships r
    where r.professional_patient_id = v_patient.id
      and r.professional_user_id = v_invitation.professional_user_id
      and r.tutor_user_id = v_user_id
      and r.pet_id = v_patient.pet_id;


    if v_patient_relationship_count = 1 then
      select r.id
        into v_relationship_id
      from public.professional_relationships r
      where r.professional_patient_id = v_patient.id
        and r.professional_user_id = v_invitation.professional_user_id
        and r.tutor_user_id = v_user_id
        and r.pet_id = v_patient.pet_id
      limit 1;
    end if;


    if v_patient_relationship_count <> 1 then
      raise exception 'ACCEPTED_INVITATION_INTEGRITY_ERROR';
    end if;


    return query select
      v_invitation.id,
      v_patient.id,
      v_patient.pet_id,
      v_relationship_id,
      v_patient.initial_weight_entry_id,
      v_patient.id,
      'accepted'::text;
    return;
  end if;


  -- Retry of a duplicate-resolution invitation: follow the explicit canonical
  -- reference and its original historical relationship.
  if v_invitation.status = 'resolved' then
    if v_invitation.resolved_by is distinct from v_user_id then
      raise exception 'INVITATION_ALREADY_RESOLVED';
    end if;


    if v_patient.status <> 'closed'
      or v_patient.closed_reason is distinct from 'duplicate'
      or v_patient.duplicate_of_patient_id is null then
      raise exception 'RESOLVED_INVITATION_INTEGRITY_ERROR';
    end if;


    select *
      into v_canonical
    from public.professional_patients p
    where p.id = v_patient.duplicate_of_patient_id
    for update;


    if not found
      or v_canonical.professional_user_id is distinct from v_invitation.professional_user_id
      or v_canonical.pet_id is null
      or v_canonical.tutor_user_id is distinct from v_user_id then
      raise exception 'RESOLVED_INVITATION_INTEGRITY_ERROR';
    end if;


    perform 1
    from public.professional_relationships r
    where r.professional_patient_id = v_canonical.id
      and r.professional_user_id = v_invitation.professional_user_id
      and r.tutor_user_id = v_user_id
      and r.pet_id = v_canonical.pet_id
    for update;


    select count(*)
      into v_patient_relationship_count
    from public.professional_relationships r
    where r.professional_patient_id = v_canonical.id
      and r.professional_user_id = v_invitation.professional_user_id
      and r.tutor_user_id = v_user_id
      and r.pet_id = v_canonical.pet_id;


    if v_patient_relationship_count = 1 then
      select r.id
        into v_relationship_id
      from public.professional_relationships r
      where r.professional_patient_id = v_canonical.id
        and r.professional_user_id = v_invitation.professional_user_id
        and r.tutor_user_id = v_user_id
        and r.pet_id = v_canonical.pet_id
      limit 1;
    end if;


    if v_patient_relationship_count <> 1 then
      raise exception 'RESOLVED_INVITATION_INTEGRITY_ERROR';
    end if;


    return query select
      v_invitation.id,
      v_patient.id,
      v_canonical.pet_id,
      v_relationship_id,
      null::uuid,
      v_canonical.id,
      'already_active'::text;
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


  if v_patient.status <> 'invited'
    or v_patient.pet_id is not null
    or v_patient.tutor_user_id is not null
    or v_patient.initial_weight_entry_id is not null
    or v_patient.closed_reason is not null
    or v_patient.duplicate_of_patient_id is not null then
    raise exception 'PROFESSIONAL_PATIENT_INTEGRITY_ERROR';
  end if;


  if p_existing_pet_id is not null then
    select *
      into v_pet
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


    v_pet_id := v_pet.id;


    -- Lock and classify any current professional case for this pet.
    perform 1
    from public.professional_patients p
    where p.professional_user_id = v_invitation.professional_user_id
      and p.pet_id = v_pet_id
      and p.id <> v_patient.id
      and p.status <> 'closed'
    for update;


    select count(*)
      into v_case_count
    from public.professional_patients p
    where p.professional_user_id = v_invitation.professional_user_id
      and p.pet_id = v_pet_id
      and p.id <> v_patient.id
      and p.status <> 'closed';


    if v_case_count > 1 then
      raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
    end if;


    if v_case_count = 1 then
      select *
        into v_canonical
      from public.professional_patients p
      where p.professional_user_id = v_invitation.professional_user_id
        and p.pet_id = v_pet_id
        and p.id <> v_patient.id
        and p.status <> 'closed'
      limit 1;
    end if;


    -- Lock every active relationship for professional+pet, regardless of tutor.
    perform 1
    from public.professional_relationships r
    where r.professional_user_id = v_invitation.professional_user_id
      and r.pet_id = v_pet_id
      and r.status = 'active'
    for update;


    select count(*)
      into v_active_relationship_count
    from public.professional_relationships r
    where r.professional_user_id = v_invitation.professional_user_id
      and r.pet_id = v_pet_id
      and r.status = 'active';


    if v_case_count = 1 then
      if v_canonical.status <> 'active'
        or v_canonical.tutor_user_id is distinct from v_user_id
        or v_active_relationship_count <> 1 then
        raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
      end if;


      select *
        into v_relationship
      from public.professional_relationships r
      where r.professional_user_id = v_invitation.professional_user_id
        and r.pet_id = v_pet_id
        and r.status = 'active'
      limit 1;


      if v_relationship.tutor_user_id is distinct from v_user_id
        or v_relationship.professional_patient_id is distinct from v_canonical.id then
        raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
      end if;


      -- Duplicate resolution deliberately has no clinical side effects:
      -- no pet mutation, no weight materialization, no new relationship.
      update public.professional_patients
      set status = 'closed',
          closed_reason = 'duplicate',
          duplicate_of_patient_id = v_canonical.id,
          updated_at = now()
      where id = v_patient.id;


      update public.professional_invitations
      set status = 'resolved',
          resolved_by = v_user_id,
          resolved_at = now()
      where id = v_invitation.id;


      return query select
        v_invitation.id,
        v_patient.id,
        v_pet_id,
        v_relationship.id,
        null::uuid,
        v_canonical.id,
        'already_active'::text;
      return;
    end if;


    if v_active_relationship_count <> 0 then
      raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
    end if;


    -- Existing-pet enrichment remains only on the true new-case happy path.
    if nullif(btrim(v_pet.breed), '') is null
      and nullif(btrim(v_patient.breed), '') is not null then
      update public.pets
      set breed = btrim(v_patient.breed)
      where id = v_pet.id;
    end if;
  else
    insert into public.pets (user_id, name, species, icon, breed)
    values (
      v_user_id,
      btrim(v_patient.pet_name),
      v_patient.species,
      case when v_patient.species = 'dog' then '🐶' else '🐈' end,
      nullif(btrim(v_patient.breed), '')
    )
    returning id into v_pet_id;
  end if;


  v_weight_entry_id := null;


  if v_patient.initial_weight_kg is not null then
    insert into public.weight_entries (
      user_id,
      pet_id,
      recorded_at,
      weight_kg,
      notes,
      recorded_by,
      source
    )
    values (
      v_user_id,
      v_pet_id,
      coalesce(v_patient.initial_weight_recorded_at, v_patient.created_at::date),
      v_patient.initial_weight_kg,
      'Peso inicial informado no cadastro profissional.',
      v_invitation.professional_user_id,
      'veterinarian'
    )
    returning id into v_weight_entry_id;
  end if;


  update public.professional_patients
  set pet_id = v_pet_id,
      tutor_user_id = v_user_id,
      tutor_email = lower(btrim(v_invitation.tutor_email)),
      initial_weight_entry_id = v_weight_entry_id,
      status = 'active',
      updated_at = now()
  where id = v_patient.id;


  perform 1
  from public.professional_relationships r
  where r.professional_user_id = v_invitation.professional_user_id
    and r.pet_id = v_pet_id
    and r.status = 'active'
  for update;


  select count(*)
    into v_active_relationship_count
  from public.professional_relationships r
  where r.professional_user_id = v_invitation.professional_user_id
    and r.pet_id = v_pet_id
    and r.status = 'active';


  if v_active_relationship_count = 0 then
    insert into public.professional_relationships (
      professional_user_id,
      tutor_user_id,
      pet_id,
      professional_patient_id,
      status
    )
    values (
      v_invitation.professional_user_id,
      v_user_id,
      v_pet_id,
      v_patient.id,
      'active'
    )
    returning id into v_relationship_id;
  elsif v_active_relationship_count = 1 then
    select *
      into v_relationship
    from public.professional_relationships r
    where r.professional_user_id = v_invitation.professional_user_id
      and r.pet_id = v_pet_id
      and r.status = 'active'
    limit 1;


    if v_relationship.tutor_user_id is distinct from v_user_id
      or v_relationship.professional_patient_id is distinct from v_patient.id then
      raise exception 'ACTIVE_RELATIONSHIP_CONFLICT';
    end if;


    v_relationship_id := v_relationship.id;
  else
    raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
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
    v_weight_entry_id,
    v_patient.id,
    'accepted'::text;
end;
$function$




revoke all on function public.accept_professional_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_professional_invitation(text, uuid) to authenticated;


notify pgrst, 'reload schema';