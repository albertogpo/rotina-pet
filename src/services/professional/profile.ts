import { toAppError } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import type { ProfessionalProfile, ProfessionalProfileInput } from "../../types/professional";

function client() {
  if (!supabase) throw new Error("Supabase ainda não configurado.");
  return supabase;
}

function nullable(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function hasVeterinarianRole(): Promise<boolean> {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError) throw toAppError(userError, "Não foi possível identificar a conta atual.");
  if (!userData.user) return false;

  const { data, error } = await client()
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "veterinarian")
    .maybeSingle();

  if (error) throw toAppError(error, "Não foi possível consultar o perfil profissional.");
  return Boolean(data);
}

export async function ensureVeterinarianRole(): Promise<void> {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError) throw toAppError(userError, "Não foi possível identificar a conta atual.");
  if (!userData.user) throw new Error("Usuário não autenticado.");

  const { error } = await client()
    .from("user_roles")
    .upsert({ user_id: userData.user.id, role: "veterinarian" }, { onConflict: "user_id,role" });

  if (error) throw toAppError(error, "Não foi possível ativar o perfil profissional.");
}

export async function getProfessionalProfile(): Promise<ProfessionalProfile | null> {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError) throw toAppError(userError, "Não foi possível identificar a conta atual.");
  if (!userData.user) return null;

  const { data, error } = await client()
    .from("professional_profiles")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw toAppError(error, "Não foi possível consultar o perfil profissional.");
  return data as ProfessionalProfile | null;
}

export async function upsertProfessionalProfile(input: ProfessionalProfileInput): Promise<ProfessionalProfile> {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError) throw toAppError(userError, "Não foi possível identificar a conta atual.");
  if (!userData.user) throw new Error("Usuário não autenticado.");

  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Informe o nome profissional.");

  await ensureVeterinarianRole();

  const payload = {
    user_id: userData.user.id,
    display_name: displayName,
    crmv: nullable(input.crmv),
    crmv_state: nullable(input.crmvState)?.toUpperCase() ?? null,
    credentials: nullable(input.credentials),
    clinic_name: nullable(input.clinicName),
    professional_email: nullable(input.professionalEmail)?.toLowerCase() ?? null,
    professional_phone: nullable(input.professionalPhone),
    logo_path: nullable(input.logoPath),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client()
    .from("professional_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw toAppError(error, "Não foi possível salvar o perfil profissional.");
  return data as ProfessionalProfile;
}
