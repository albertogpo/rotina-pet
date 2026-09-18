-- Wave 1 / v0.8.1
-- Consolidates the final create_professional_invitation definition already
-- running in production after the smoke-test fixes.
-- Safe intent: function replacement only; no data cleanup or destructive DDL.

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
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id and ur.role = 'veterinarian'
  ) then
    raise exception 'VETERINARIAN_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from public.professional_profiles pp
    where pp.user_id = v_user_id
  ) then
    raise exception 'PROFESSIONAL_PROFILE_REQUIRED';
  end if;

  select * into v_patient
  from public.professional_patients pp
  where pp.id = p_professional_patient_id
    and pp.professional_user_id = v_user_id
  for update;

  if not found then
    raise exception 'PROFESSIONAL_PATIENT_NOT_FOUND';
  end if;

  if v_patient.pet_id is not null or v_patient.tutor_user_id is not null or v_patient.status in ('active', 'closed') then
    raise exception 'PROFESSIONAL_PATIENT_NOT_INVITABLE';
  end if;

  update public.professional_invitations i
  set status = case
    when i.expires_at is not null and i.expires_at <= now() then 'expired'
    else 'revoked'
  end
  where i.professional_patient_id = v_patient.id
    and i.status = 'pending';

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

  update public.professional_patients pp
  set tutor_email = v_email,
      status = 'invited',
      updated_at = now()
  where pp.id = v_patient.id;

  return query select v_invitation_id, v_token, v_expires_at;
end;
$$;

revoke all on function public.create_professional_invitation(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_professional_invitation(uuid, text, timestamptz) to authenticated;
