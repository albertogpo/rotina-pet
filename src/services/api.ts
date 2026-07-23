import type {Session} from "@supabase/supabase-js";
import {supabase} from "../lib/supabase";
import type {Food,FoodUnit,MealConsumptionLevel,MealOccurrence,Pet,PlanFoodInput,Species,UserPreferences,WeightEntry} from "../types";

function client(){if(!supabase)throw new Error("Supabase ainda não configurado.");return supabase;}
function appRedirectUrl(){return new URL(import.meta.env.BASE_URL,window.location.href).toString();}

export async function getSession():Promise<Session|null>{const{data,error}=await client().auth.getSession();if(error)throw error;return data.session;}
export async function signIn(email:string,password:string){const{error}=await client().auth.signInWithPassword({email,password});if(error)throw error;}
export async function signUp(email:string,password:string){const{data,error}=await client().auth.signUp({email,password,options:{emailRedirectTo:appRedirectUrl()}});if(error)throw error;return data;}
export async function sendPasswordReset(email:string){const{error}=await client().auth.resetPasswordForEmail(email,{redirectTo:appRedirectUrl()});if(error)throw error;}
export async function signOut(){const{error}=await client().auth.signOut();if(error)throw error;}

export async function ensureUserPreferences(detectedTimezone:string):Promise<UserPreferences>{const{data,error}=await client().rpc("ensure_user_preferences",{p_timezone:detectedTimezone});if(error)throw error;return data as UserPreferences;}
export async function updateUserTimezone(timezone:string):Promise<UserPreferences>{const{data,error}=await client().rpc("update_user_timezone",{p_timezone:timezone});if(error)throw error;return data as UserPreferences;}

export async function listPets():Promise<Pet[]>{const{data,error}=await client().from("pets").select("*").eq("active",true).order("created_at");if(error)throw error;return data as Pet[];}
export async function listArchivedPets():Promise<Pet[]>{const{data,error}=await client().from("pets").select("*").eq("active",false).order("created_at",{ascending:false});if(error)throw error;return data as Pet[];}
export async function createPet(userId:string,input:{name:string;species:Species;icon:string}){const{data,error}=await client().from("pets").insert({user_id:userId,...input}).select().single();if(error)throw error;return data as Pet;}
export async function updatePet(id:string,input:{name:string;species:Species;icon:string}){const{data,error}=await client().from("pets").update(input).eq("id",id).select().single();if(error)throw error;return data as Pet;}
export async function archivePet(id:string){const{error}=await client().from("pets").update({active:false}).eq("id",id);if(error)throw error;}
export async function restorePet(id:string){const{error}=await client().from("pets").update({active:true}).eq("id",id);if(error)throw error;}

export async function listWeights(petId:string):Promise<WeightEntry[]>{const{data,error}=await client().from("weight_entries").select("*").eq("pet_id",petId).order("recorded_at",{ascending:false});if(error)throw error;return data as WeightEntry[];}
export async function addWeight(userId:string,petId:string,recordedAt:string,weightKg:number,notes:string){const{data,error}=await client().from("weight_entries").insert({user_id:userId,pet_id:petId,recorded_at:recordedAt,weight_kg:weightKg,notes:notes.trim()||null}).select().single();if(error)throw error;return data as WeightEntry;}
export async function deleteWeight(id:string){const{error}=await client().from("weight_entries").delete().eq("id",id);if(error)throw error;}

export async function listFoods():Promise<Food[]>{const{data,error}=await client().from("foods").select("*").eq("active",true).order("name");if(error)throw error;return data as Food[];}
export async function createFood(userId:string,name:string,defaultUnit:FoodUnit){const{data,error}=await client().from("foods").insert({user_id:userId,name:name.trim(),default_unit:defaultUnit}).select().single();if(error)throw error;return data as Food;}
export async function updateFood(id:string,name:string,defaultUnit:FoodUnit){const{data,error}=await client().from("foods").update({name:name.trim(),default_unit:defaultUnit}).eq("id",id).select().single();if(error)throw error;return data as Food;}
export async function archiveFood(id:string){const{error}=await client().from("foods").update({active:false}).eq("id",id);if(error)throw error;}

export async function savePlan(input:{petId:string;name:string;startsOn:string;mealTimes:string[];foods:PlanFoodInput[]}){const payload=input.foods.map(food=>({food_id:food.foodId,daily_quantity:Number(food.dailyQuantity.replace(",",".")),unit:food.unit,meal_sequences:food.mealSequences}));const{data,error}=await client().rpc("save_diet_plan",{p_pet_id:input.petId,p_name:input.name,p_starts_on:input.startsOn,p_meal_times:input.mealTimes,p_foods:payload});if(error)throw new Error(error.message);return data as string;}
export async function updatePlanSchedule(planId:string,startsOn:string,mealTimes:string[]){const{data,error}=await client().rpc("update_diet_plan_schedule",{p_plan_id:planId,p_starts_on:startsOn,p_meal_times:mealTimes});if(error)throw new Error(error.message);return data as string;}
export async function getActivePlan(petId:string,date:string){const{data,error}=await client().from("diet_plans").select(`id,name,starts_on,ends_on,active,created_at,meal_templates(id,scheduled_time,sequence,meal_components(id,quantity,unit,foods(name))),plan_foods(id,daily_quantity,unit,meal_sequences,foods(id,name))`).eq("pet_id",petId).lte("starts_on",date).or(`ends_on.is.null,ends_on.gte.${date}`).order("starts_on",{ascending:false}).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data;}
export async function ensureMealsForDate(date:string){const{error}=await client().rpc("ensure_meal_occurrences_for_date",{p_local_date:date});if(error)throw error;return listMealsForDate(date);}

export async function listMealsForDate(date:string):Promise<MealOccurrence[]>{
  const[occurrencesResult,plansResult]=await Promise.all([
    client().from("meal_occurrences").select(`*,meal_templates(id,diet_plan_id,scheduled_time,sequence,meal_components(id,quantity,unit,foods(name)))`).eq("local_date",date).order("scheduled_at"),
    client().from("diet_plans").select("id,pet_id,starts_on,created_at").lte("starts_on",date).or(`ends_on.is.null,ends_on.gte.${date}`).order("pet_id").order("starts_on",{ascending:false}).order("created_at",{ascending:false}),
  ]);

  if(occurrencesResult.error)throw occurrencesResult.error;
  if(plansResult.error)throw plansResult.error;

  const selectedPlanByPet=new Map<string,string>();
  for(const plan of plansResult.data??[]){
    if(!selectedPlanByPet.has(plan.pet_id))selectedPlanByPet.set(plan.pet_id,plan.id);
  }

  const meals=(occurrencesResult.data??[]) as unknown as MealOccurrence[];
  return meals.filter(meal=>{
    if(meal.status!=="pending")return true;
    return meal.meal_templates?.diet_plan_id===selectedPlanByPet.get(meal.pet_id);
  });
}

export async function listMeals(petId:string,date:string):Promise<MealOccurrence[]>{
  return(await listMealsForDate(date)).filter(meal=>meal.pet_id===petId);
}
export async function setMealOutcome(id:string,status:"pending"|"completed"|"skipped",consumptionLevel:MealConsumptionLevel|null){
  if(status==="pending"){
    const{error}=await client().rpc("reset_meal_occurrence",{p_occurrence_id:id});
    if(error)throw new Error(error.message);
    return;
  }

  const{error}=await client().from("meal_occurrences").update({status,consumption_level:status==="completed"?consumptionLevel:null,completed_at:status==="completed"?new Date().toISOString():null}).eq("id",id);
  if(error)throw new Error(error.message);
}
