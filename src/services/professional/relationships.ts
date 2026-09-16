import { supabase } from "../../lib/supabase";
import type { ProfessionalRelationship } from "../../types/professional";

function client() {
  if (!supabase) throw new Error("Supabase ainda não configurado.");
  return supabase;
}

export async function listProfessionalRelationships(
  status: ProfessionalRelationship["status"] | "all" = "active",
): Promise<ProfessionalRelationship[]> {
  let query = client()
    .from("professional_relationships")
    .select("*")
    .order("started_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return data as ProfessionalRelationship[];
}

export async function getActiveRelationshipForPet(petId: string): Promise<ProfessionalRelationship | null> {
  const { data, error } = await client()
    .from("professional_relationships")
    .select("*")
    .eq("pet_id", petId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data as ProfessionalRelationship | null;
}
