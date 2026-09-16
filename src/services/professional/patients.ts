import { supabase } from "../../lib/supabase";
import type { PreliminaryPatientInput, ProfessionalPatient } from "../../types/professional";

function client() {
  if (!supabase) throw new Error("Supabase ainda não configurado.");
  return supabase;
}

function nullable(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function patientPayload(input: PreliminaryPatientInput) {
  const petName = input.petName.trim();
  if (!petName) throw new Error("Informe o nome do paciente.");
  if (input.initialWeightKg != null && input.initialWeightKg <= 0) {
    throw new Error("O peso inicial deve ser maior que zero.");
  }

  const tutorEmail = nullable(input.tutorEmail)?.toLowerCase() ?? null;
  if (tutorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tutorEmail)) {
    throw new Error("Informe um e-mail válido para o tutor.");
  }

  return {
    pet_name: petName,
    species: input.species,
    breed: nullable(input.breed),
    tutor_email: tutorEmail,
    initial_weight_kg: input.initialWeightKg ?? null,
    initial_weight_recorded_at: input.initialWeightRecordedAt ?? null,
  };
}

export async function listProfessionalPatients(): Promise<ProfessionalPatient[]> {
  const { data, error } = await client()
    .from("professional_patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as ProfessionalPatient[];
}

export async function getProfessionalPatient(id: string): Promise<ProfessionalPatient | null> {
  const { data, error } = await client()
    .from("professional_patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as ProfessionalPatient | null;
}

export async function createPreliminaryPatient(input: PreliminaryPatientInput): Promise<ProfessionalPatient> {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Usuário não autenticado.");

  const { data, error } = await client()
    .from("professional_patients")
    .insert({
      professional_user_id: userData.user.id,
      ...patientPayload(input),
      status: "draft",
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProfessionalPatient;
}

export async function updatePreliminaryPatient(
  id: string,
  input: PreliminaryPatientInput,
): Promise<ProfessionalPatient> {
  const { data, error } = await client()
    .from("professional_patients")
    .update({
      ...patientPayload(input),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ProfessionalPatient;
}

export async function deletePreliminaryPatient(id: string): Promise<void> {
  const { error } = await client().from("professional_patients").delete().eq("id", id);
  if (error) throw error;
}
