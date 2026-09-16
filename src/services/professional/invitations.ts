import { supabase } from "../../lib/supabase";
import type { Pet } from "../../types";
import type {
  AcceptProfessionalInvitationResult,
  CreateProfessionalInvitationInput,
  CreatedProfessionalInvitation,
  InvitationPetMatch,
  InvitationPetResolution,
  ProfessionalInvitationPreview,
} from "../../types/professional";

function client() {
  if (!supabase) throw new Error("Supabase ainda não configurado.");
  return supabase;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

export function matchInvitationPet(preview: ProfessionalInvitationPreview, pet: Pet): InvitationPetMatch | null {
  if (pet.species !== preview.species) return null;

  const invitationName = normalizeName(preview.petName);
  const petName = normalizeName(pet.name);
  if (!invitationName || !petName) return null;

  if (invitationName === petName) {
    return { pet, strength: "strong", score: 100 };
  }

  const distance = levenshtein(invitationName, petName);
  const longest = Math.max(invitationName.length, petName.length);
  const similarity = longest ? 1 - distance / longest : 0;

  const probable =
    (longest >= 4 && distance === 1) ||
    (longest >= 6 && distance === 2 && similarity >= 0.72);

  if (!probable) return null;

  let score = Math.round(similarity * 100);
  if (preview.breed && pet.breed && normalizeName(preview.breed) === normalizeName(pet.breed)) score += 2;

  return { pet, strength: "probable", score };
}

export function resolveInvitationPets(
  preview: ProfessionalInvitationPreview,
  pets: Pet[],
): InvitationPetResolution {
  // Pets de outra espécie não são reutilizáveis para este caso e não devem poluir a UI.
  const compatiblePets = pets.filter((pet) => pet.active && pet.species === preview.species);
  if (!compatiblePets.length) return { mode: "create", compatiblePets: [] };

  const matches = compatiblePets
    .map((pet) => matchInvitationPet(preview, pet))
    .filter((match): match is InvitationPetMatch => match !== null)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) return { mode: "manual", compatiblePets };

  const [best, second] = matches;
  const ambiguous = second && best.score - second.score < 8;
  if (ambiguous) return { mode: "manual", compatiblePets };

  return { mode: "suggestion", compatiblePets, suggestion: best };
}

export async function createProfessionalInvitation(
  input: CreateProfessionalInvitationInput,
): Promise<CreatedProfessionalInvitation> {
  const tutorEmail = input.tutorEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tutorEmail)) {
    throw new Error("Informe um e-mail válido para o tutor.");
  }

  const { data, error } = await client().rpc("create_professional_invitation", {
    p_professional_patient_id: input.professionalPatientId,
    p_tutor_email: tutorEmail,
    p_expires_at: input.expiresAt ?? null,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Não foi possível criar o convite profissional.");

  return {
    invitationId: row.invitation_id as string,
    token: row.token as string,
    expiresAt: row.expires_at as string,
  };
}

export async function getProfessionalInvitationPreview(token: string): Promise<ProfessionalInvitationPreview | null> {
  const { data, error } = await client().rpc("get_professional_invitation_preview", {
    p_token: token.trim(),
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    invitationId: row.invitation_id as string,
    professionalPatientId: row.professional_patient_id as string,
    petName: row.pet_name as string,
    species: row.species as ProfessionalInvitationPreview["species"],
    breed: (row.breed as string | null) ?? null,
    professionalName: row.professional_name as string,
    clinicName: (row.clinic_name as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    status: row.status as ProfessionalInvitationPreview["status"],
  };
}

export async function acceptProfessionalInvitation(
  token: string,
  existingPetId?: string | null,
): Promise<AcceptProfessionalInvitationResult> {
  const { data, error } = await client().rpc("accept_professional_invitation", {
    p_token: token.trim(),
    p_existing_pet_id: existingPetId ?? null,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("O aceite do convite não retornou o vínculo criado.");

  return {
    invitationId: row.invitation_id as string,
    professionalPatientId: row.professional_patient_id as string,
    petId: row.pet_id as string,
    relationshipId: row.relationship_id as string,
    initialWeightEntryId: (row.initial_weight_entry_id as string | null) ?? null,
  };
}
