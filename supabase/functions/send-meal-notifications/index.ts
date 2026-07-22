import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const supabase=createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {auth:{persistSession:false}}
);

const ONESIGNAL_APP_ID=Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY=Deno.env.get("ONESIGNAL_REST_API_KEY");
const APP_PUBLIC_URL=Deno.env.get("APP_PUBLIC_URL") ?? "https://albertogpo.github.io/rotina-pet/";

Deno.serve(async()=>{
  if(!ONESIGNAL_APP_ID||!ONESIGNAL_REST_API_KEY){
    return json({ok:false,error:"OneSignal não configurado."},500);
  }

  const nowIso=new Date().toISOString();
  const fiveMinutesAgoIso=new Date(Date.now()-5*60*1000).toISOString();

  const {data:meals,error}=await supabase
    .from("meal_occurrences")
    .select(`
      id,
      user_id,
      pet_id,
      scheduled_at,
      status,
      pets(name),
      meal_templates(
        meal_components(
          quantity,
          unit,
          foods(name)
        )
      )
    `)
    .eq("status","pending")
    .lte("scheduled_at",nowIso)
    .gt("scheduled_at",fiveMinutesAgoIso);

  if(error)return json({ok:false,error:error.message},500);
  if(!meals?.length)return json({ok:true,sent:0});

  let sent=0;

  for(const meal of meals as any[]){
    const {data:existing}=await supabase
      .from("meal_notification_log")
      .select("id")
      .eq("meal_occurrence_id",meal.id)
      .eq("notification_kind","due")
      .maybeSingle();

    if(existing)continue;

    const components=(meal.meal_templates?.meal_components ?? []) as any[];
    const body=components.length
      ?components.map((component)=>`${component.quantity} ${component.unit} de ${component.foods?.name ?? "alimento"}`).join(" · ")
      :"Confira a refeição prevista e registre o resultado no Rotina Pet.";

    const response=await fetch("https://api.onesignal.com/notifications?c=push",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body:JSON.stringify({
        app_id:ONESIGNAL_APP_ID,
        target_channel:"push",
        include_aliases:{external_id:[meal.user_id]},
        headings:{pt:`Hora da refeição de ${meal.pets?.name ?? "seu pet"}`,en:`Meal time for ${meal.pets?.name ?? "your pet"}`},
        contents:{pt:body,en:body},
        url:APP_PUBLIC_URL,
      }),
    });

    if(!response.ok){
      const errorText=await response.text();
      console.error("Erro no OneSignal",errorText);
      continue;
    }

    await supabase.from("meal_notification_log").insert({
      user_id:meal.user_id,
      meal_occurrence_id:meal.id,
      notification_kind:"due",
    });
    sent+=1;
  }

  return json({ok:true,sent});
});

function json(payload:unknown,status=200){
  return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json"}});
}
