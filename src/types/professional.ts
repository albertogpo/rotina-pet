import type { Pet, Species } from "../types";


export type ProfessionalRole = "tutor" | "veterinarian";
export type ProfessionalPatientStatus = "draft" | "invited" | "active" | "closed";
export type ProfessionalInvitationStatus = "pending" | "accepted" | "resolved" | "expired" | "revoked";
export type ProfessionalRelationshipStatus = "active" | "ended";
export type ProfessionalPatientClosedReason = "duplicate";
export type ProfessionalInvitationResolution = "accepted" | "already_active";


export type ProfessionalProfile = {
  user_id: string;
  display_name: string;
  crmv: string | null;
  crmv_state: string | null;
  credentials: string | null;
  clinic_name: string | null;
  professional_email: string | null;
  professional_phone: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
};


export type ProfessionalProfileInput = {
  displayName: string;
  crmv?: string | null;
  crmvState?: string | null;
  credentials?: string | null;
  clinicName?: string | null;
  professionalEmail?: string | null;
  professionalPhone?: string | null;
  logoPath?: string | null;
};


export type ProfessionalPatient = {
  id: string;
  professional_user_id: string;
  pet_id: string | null;
  tutor_user_id: string | null;
  tutor_email: string | null;
  pet_name: string;
  species: Species;
  breed: string | null;
  initial_weight_kg: number | null;
  initial_weight_recorded_at: string | null;
  initial_weight_entry_id: string | null;
  closed_reason: ProfessionalPatientClosedReason | null;
  duplicate_of_patient_id: string | null;
  status: ProfessionalPatientStatus;
  created_at: string;
  updated_at: string;
};


export type PreliminaryPatientInput = {
  petName: string;
  species: Species;
  breed?: string | null;
  tutorEmail?: string | null;
  initialWeightKg?: number | null;
  initialWeightRecordedAt?: string | null;
};


export type ProfessionalInvitation = {
  id: string;
  professional_patient_id: string;
  professional_user_id: string;
  tutor_email: string;
  status: ProfessionalInvitationStatus;
  expires_at: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};


export type CreateProfessionalInvitationInput = {
  professionalPatientId: string;
  tutorEmail: string;
  expiresAt?: string | null;
};


export type CreatedProfessionalInvitation = {
  invitationId: string;
  token: string;
  expiresAt: string;
};


export type ProfessionalInvitationPreview = {
  invitationId: string;
  professionalPatientId: string;
  petName: string;
  species: Species;
  breed: string | null;
  professionalName: string;
  clinicName: string | null;
  expiresAt: string | null;
  status: ProfessionalInvitationStatus;
};


export type AcceptProfessionalInvitationResult = {
  invitationId: string;
  professionalPatientId: string;
  petId: string;
  relationshipId: string;
  initialWeightEntryId: string | null;
  effectiveProfessionalPatientId: string;
  resolution: ProfessionalInvitationResolution;
};


export type ProfessionalRelationship = {
  id: string;
  professional_user_id: string;
  tutor_user_id: string;
  pet_id: string;
  professional_patient_id: string | null;
  status: ProfessionalRelationshipStatus;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};


export type PetMatchStrength = "strong" | "probable";


export type InvitationPetMatch = {
  pet: Pet;
  strength: PetMatchStrength;
  score: number;
};


export type InvitationPetResolution =
  | { mode: "create"; compatiblePets: [] }
  | { mode: "suggestion"; compatiblePets: Pet[]; suggestion: InvitationPetMatch }
  | { mode: "manual"; compatiblePets: Pet[] };