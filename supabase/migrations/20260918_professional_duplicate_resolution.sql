-- Wave 1 / v0.8.1 — Block 5
-- Resolves a new professional patient/invitation when the tutor confirms that
-- the selected pet already has an active, internally consistent case with the
-- same professional. The existing active patient remains canonical.

alter table public.professional_patients
  add column if not exists closed_reason text,
  add column if not exists duplicate_of_patient_id uuid;

alter table public.professional_patients
  drop constraint if exists professional_patients_duplicate_of_patient_id_fkey,
  add constraint professional_patients_duplicate_of_patient_id_fkey
    foreign key (duplicate_of_patient_id)
    references public.professional_patients(id);

alter table public.professional_patients
  drop constraint if exists professional_patients_duplicate_not_self_check,
  add constraint professional_patients_duplicate_not_self_check
    check (duplicate_of_patient_id is null or duplicate_of_patient_id <> id);

alter table public.professional_patients
  drop constraint if exists professional_patients_duplicate_resolution_check,
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
  drop constraint if exists professional_invitations_status_check,
  add constraint professional_invitations_status_check
    check (status in ('pending', 'accepted', 'resolved', 'expired', 'revoked'));

alter table public.professional_invitations
  drop constraint if exists professional_invitations_resolution_lifecycle_check,
  add constraint professional_invitations_resolution_lifecycle_check
    check (
      (status = 'accepted' and accepted_at is not null and resolved_at is null)
      or
      (status = 'resolved' and resolved_at is not null and accepted_at is null)
      or
      (status in ('pending', 'expired', 'revoked') and accepted_at is null and resolved_at is null)
    );

-- Return shape is extended, so PostgreSQL requires dropping the old function
-- before recreating it with the same input signature.
drop function public.accept_professional_invitation(text, uuid);

create function public.accept_professional_invitation(
  p_token text,
  p_existing_pet_id uuid default null
)
returns table (
  invitation_id uuid,
  professional_patient_id uuid,
  pet_id uuid,
  relationship_id uuid,
  initial_weight_entry_id uuid,
  effective_professional_patient_id uuid,
  resolution text
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
  v_canonical_patient public.professional_patients%rowtype;
  v_pet public.pets%rowtype;
  v_relationship public.professional_relationships%rowtype;
  v_pet_id uuid;
  v_relationship_id uuid;
  v_weight_entry_id uuid;
  v_case_count integer;
  v_active_relationship_count integer;
  v_historical_relationship_count integer;
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

  -- Keep the established lock order: source patient -> invitation. This stays
  -- compatible with create_professional_invitation, which locks the patient
  -- before revoking/replacing a pending invitation.
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

  -- Idempotent retry for an invitation that really created the case. Tie the
  -- relationship to the patient from this invitation, never merely to the
  -- currently active relationship for the pet.
  if v_invitation.status = 'accepted' then
    if v_invitation.accepted_by is distinct from v_user_id then
      raise exception 'INVITATION_ALREADY_ACCEPTED';
    end if;

    if v_patient.pet_id is null or v_patient.tutor_user_id is distinct from v_user_id then
      raise exception 'ACCEPTED_INVITATION_INTEGRITY_ERROR';
    end if;

    perform 1
    from public.professional_relationships relationship
    where relationship.professional_patient_id = v_patient.id
      and relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.tutor_user_id = v_user_id
      and relationship.pet_id = v_patient.pet_id
    for update;

    select count(*) into v_historical_relationship_count
    from public.professional_relationships relationship
    where relationship.professional_patient_id = v_patient.id
      and relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.tutor_user_id = v_user_id
      and relationship.pet_id = v_patient.pet_id;

    if v_historical_relationship_count <> 1 then
      raise exception 'ACCEPTED_INVITATION_INTEGRITY_ERROR';
    end if;

    select * into v_relationship
    from public.professional_relationships relationship
    where relationship.professional_patient_id = v_patient.id
      and relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.tutor_user_id = v_user_id
      and relationship.pet_id = v_patient.pet_id
    limit 1;

    return query select
      v_invitation.id,
      v_patient.id,
      v_patient.pet_id,
      v_relationship.id,
      v_patient.initial_weight_entry_id,
      v_patient.id,
      'accepted'::text;
    return;
  end if;

  -- Idempotent retry for a duplicate-resolution invitation. This can continue
  -- to resolve historically even after that canonical case is later closed.
  if v_invitation.status = 'resolved' then
    if v_invitation.resolved_by is distinct from v_user_id then
      raise exception 'INVITATION_ALREADY_RESOLVED';
    end if;

    if v_patient.status <> 'closed'
      or v_patient.closed_reason is distinct from 'duplicate'
      or v_patient.duplicate_of_patient_id is null then
      raise exception 'RESOLVED_INVITATION_INTEGRITY_ERROR';
    end if;

    select * into v_canonical_patient
    from public.professional_patients canonical
    where canonical.id = v_patient.duplicate_of_patient_id
    for update;

    if not found
      or v_canonical_patient.professional_user_id is distinct from v_invitation.professional_user_id
      or v_canonical_patient.pet_id is null
      or v_canonical_patient.tutor_user_id is distinct from v_user_id then
      raise exception 'RESOLVED_INVITATION_INTEGRITY_ERROR';
    end if;

    perform 1
    from public.professional_relationships relationship
    where relationship.professional_patient_id = v_canonical_patient.id
      and relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.tutor_user_id = v_user_id
      and relationship.pet_id = v_canonical_patient.pet_id
    for update;

    select count(*) into v_historical_relationship_count
    from public.professional_relationships relationship
    where relationship.professional_patient_id = v_canonical_patient.id
      and relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.tutor_user_id = v_user_id
      and relationship.pet_id = v_canonical_patient.pet_id;

    if v_historical_relationship_count <> 1 then
      raise exception 'RESOLVED_INVITATION_INTEGRITY_ERROR';
    end if;

    select * into v_relationship
    from public.professional_relationships relationship
    where relationship.professional_patient_id = v_canonical_patient.id
      and relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.tutor_user_id = v_user_id
      and relationship.pet_id = v_canonical_patient.pet_id
    limit 1;

    return query select
      v_invitation.id,
      v_patient.id,
      v_canonical_patient.pet_id,
      v_relationship.id,
      null::uuid,
      v_canonical_patient.id,
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

  -- A pending invitation is only valid for an untouched preliminary patient.
  if v_patient.status <> 'invited'
    or v_patient.pet_id is not null
    or v_patient.tutor_user_id is not null
    or v_patient.initial_weight_entry_id is not null
    or v_patient.closed_reason is not null
    or v_patient.duplicate_of_patient_id is not null then
    raise exception 'PROFESSIONAL_PATIENT_INTEGRITY_ERROR';
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

    v_pet_id := v_pet.id;

    -- Lock any current case for this professional+pet before classifying the
    -- state. The existing partial unique index remains the final protection.
    perform 1
    from public.professional_patients other_patient
    where other_patient.professional_user_id = v_invitation.professional_user_id
      and other_patient.pet_id = v_pet_id
      and other_patient.id <> v_patient.id
      and other_patient.status <> 'closed'
    for update;

    select count(*) into v_case_count
    from public.professional_patients other_patient
    where other_patient.professional_user_id = v_invitation.professional_user_id
      and other_patient.pet_id = v_pet_id
      and other_patient.id <> v_patient.id
      and other_patient.status <> 'closed';

    if v_case_count > 1 then
      raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
    end if;

    if v_case_count = 1 then
      select * into v_canonical_patient
      from public.professional_patients other_patient
      where other_patient.professional_user_id = v_invitation.professional_user_id
        and other_patient.pet_id = v_pet_id
        and other_patient.id <> v_patient.id
        and other_patient.status <> 'closed'
      limit 1;
    end if;

    -- Lock every active relationship for professional+pet, regardless of tutor,
    -- so corrupted cross-tutor states cannot be mistaken for idempotent success.
    perform 1
    from public.professional_relationships relationship
    where relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.pet_id = v_pet_id
      and relationship.status = 'active'
    for update;

    select count(*) into v_active_relationship_count
    from public.professional_relationships relationship
    where relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.pet_id = v_pet_id
      and relationship.status = 'active';

    if v_case_count = 1 then
      if v_canonical_patient.status <> 'active'
        or v_canonical_patient.tutor_user_id is distinct from v_user_id
        or v_active_relationship_count <> 1 then
        raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
      end if;

      select * into v_relationship
      from public.professional_relationships relationship
      where relationship.professional_user_id = v_invitation.professional_user_id
        and relationship.pet_id = v_pet_id
        and relationship.status = 'active'
      limit 1;

      if v_relationship.tutor_user_id is distinct from v_user_id
        or v_relationship.professional_patient_id is distinct from v_canonical_patient.id then
        raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
      end if;

      -- Duplicate resolution: preserve the preliminary snapshot, but do not
      -- materialize weight, mutate the pet, create a relationship, or rewrite
      -- the canonical case.
      update public.professional_patients
      set status = 'closed',
          closed_reason = 'duplicate',
          duplicate_of_patient_id = v_canonical_patient.id,
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
        v_canonical_patient.id,
        'already_active'::text;
      return;
    end if;

    -- No current patient but an active relationship is not a legitimate
    -- historical state. Do not repair it implicitly during invitation accept.
    if v_active_relationship_count <> 0 then
      raise exception 'PROFESSIONAL_CASE_INTEGRITY_ERROR';
    end if;

    -- Only a true new-link happy path may enrich a missing breed. A duplicate
    -- resolution above deliberately has no side effects on the existing pet.
    if nullif(btrim(v_pet.breed), '') is null and nullif(btrim(v_patient.breed), '') is not null then
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
    ) returning id into v_pet_id;
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

  -- Re-check after patient activation. Pet row locking serializes this RPC's
  -- same-pet accepts; the existing unique index remains the final safeguard.
  perform 1
  from public.professional_relationships relationship
  where relationship.professional_user_id = v_invitation.professional_user_id
    and relationship.pet_id = v_pet_id
    and relationship.status = 'active'
  for update;

  select count(*) into v_active_relationship_count
  from public.professional_relationships relationship
  where relationship.professional_user_id = v_invitation.professional_user_id
    and relationship.pet_id = v_pet_id
    and relationship.status = 'active';

  if v_active_relationship_count = 0 then
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
  elsif v_active_relationship_count = 1 then
    select * into v_relationship
    from public.professional_relationships relationship
    where relationship.professional_user_id = v_invitation.professional_user_id
      and relationship.pet_id = v_pet_id
      and relationship.status = 'active'
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
$$;

revoke all on function public.accept_professional_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_professional_invitation(text, uuid) to authenticated;

notify pgrst, 'reload schema';
