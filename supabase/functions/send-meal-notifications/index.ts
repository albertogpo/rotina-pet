import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const supabase=createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {auth:{persistSession:false}}
);

const ONESIGNAL_APP_ID=Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY=Deno.env.get("ONESIGNAL_REST_API_KEY");
const APP_PUBLIC_URL=Deno.env.get("APP_PUBLIC_URL")??"https://albertogpo.github.io/rotina-pet/";
const DUE_WINDOW_MINUTES=readPositiveInteger("MEAL_NOTIFICATION_WINDOW_MINUTES",10);
const NOTIFICATION_TTL_SECONDS=readPositiveInteger("MEAL_NOTIFICATION_TTL_SECONDS",30*60);
const MAX_BODY_LENGTH=150;

const UNIT_LABELS:Record<string,string>={
  g:"g",
  ml:"ml",
  sachet:"sachê",
  can:"lata",
  scoop:"medida",
  unit:"unidade",
};

type RawComponent={quantity:number|string;unit:string;foods:{name:string}|Array<{name:string}>|null};
type RawTemplate={scheduled_time:string;meal_components:RawComponent[]|null};
type RawPet={name:string;icon:string};
type RawMeal={
  id:string;
  user_id:string;
  pet_id:string;
  local_date:string;
  scheduled_at:string;
  status:string;
  pets:RawPet|RawPet[]|null;
  meal_templates:RawTemplate|RawTemplate[]|null;
};
type ClaimedGroup={id:string;idempotency_key:string;attempt_count:number};
type ItemSummary={name:string;quantity:number;unit:string};
type PetSummary={id:string;name:string;icon:string;items:ItemSummary[]};

Deno.serve(async()=>{
  try{
    if(!ONESIGNAL_APP_ID||!ONESIGNAL_REST_API_KEY){
      return json({ok:false,error:"OneSignal não configurado."},500);
    }

    const now=new Date();
    const nowIso=now.toISOString();
    const windowStartIso=new Date(now.getTime()-DUE_WINDOW_MINUTES*60*1000).toISOString();

    const {error:ensureError}=await supabase.rpc("ensure_due_meal_occurrences",{p_now:nowIso});
    if(ensureError)return json({ok:false,error:`Falha ao gerar ocorrências: ${ensureError.message}`},500);

    const {data:mealRows,error:mealsError}=await supabase
      .from("meal_occurrences")
      .select(`
        id,
        user_id,
        pet_id,
        local_date,
        scheduled_at,
        status,
        pets(name,icon),
        meal_templates(
          scheduled_time,
          meal_components(
            quantity,
            unit,
            foods(name)
          )
        )
      `)
      .eq("status","pending")
      .lte("scheduled_at",nowIso)
      .gt("scheduled_at",windowStartIso)
      .order("scheduled_at");

    if(mealsError)return json({ok:false,error:mealsError.message},500);
    const meals=(mealRows??[]) as unknown as RawMeal[];
    if(!meals.length)return json({ok:true,groups:0,sent:0,skipped:0,failed:0});

    const occurrenceIds=meals.map(meal=>meal.id);
    const {data:loggedRows,error:logsError}=await supabase
      .from("meal_notification_log")
      .select("meal_occurrence_id")
      .eq("notification_kind","due")
      .in("meal_occurrence_id",occurrenceIds);

    if(logsError)return json({ok:false,error:logsError.message},500);
    const loggedIds=new Set((loggedRows??[]).map(row=>row.meal_occurrence_id as string));
    const pendingMeals=meals.filter(meal=>!loggedIds.has(meal.id));
    if(!pendingMeals.length)return json({ok:true,groups:0,sent:0,skipped:0,failed:0});

    const userIds=[...new Set(pendingMeals.map(meal=>meal.user_id))];
    const {data:preferenceRows,error:preferencesError}=await supabase
      .from("user_preferences")
      .select("user_id,timezone")
      .in("user_id",userIds);

    if(preferencesError)return json({ok:false,error:preferencesError.message},500);
    const timezones=new Map((preferenceRows??[]).map(row=>[
      row.user_id as string,
      typeof row.timezone==="string"?row.timezone:"America/Sao_Paulo",
    ]));

    const grouped=new Map<string,RawMeal[]>();
    for(const meal of pendingMeals){
      const key=`${meal.user_id}|${meal.scheduled_at}`;
      grouped.set(key,[...(grouped.get(key)??[]),meal]);
    }

    let sent=0;
    let skipped=0;
    let failed=0;

    for(const groupMeals of grouped.values()){
      const first=groupMeals[0];
      const {data:claimData,error:claimError}=await supabase.rpc("claim_meal_notification_group",{
        p_user_id:first.user_id,
        p_scheduled_at:first.scheduled_at,
        p_notification_kind:"due",
      });

      if(claimError){
        console.error("Falha ao reservar grupo",claimError);
        failed+=1;
        continue;
      }

      const claim=claimData as ClaimedGroup|null;
      if(!claim)continue;

      try{
        // O estado pode mudar entre a consulta inicial e o envio.
        // Revalidamos aqui para nunca notificar uma ocorrência já registrada.
        const candidateIds=groupMeals.map(meal=>meal.id);
        const {data:stillPendingRows,error:recheckError}=await supabase
          .from("meal_occurrences")
          .select("id")
          .in("id",candidateIds)
          .eq("status","pending");

        if(recheckError)throw recheckError;
        const stillPendingIds=new Set((stillPendingRows??[]).map(row=>row.id as string));
        const sendableMeals=groupMeals.filter(meal=>stillPendingIds.has(meal.id));

        if(!sendableMeals.length){
          const {error:completeError}=await supabase.rpc("complete_meal_notification_group",{
            p_group_id:claim.id,
            p_status:"skipped",
            p_message_id:null,
            p_occurrence_ids:[],
            p_note:"Todas as refeições do grupo já estavam registradas antes do envio.",
          });
          if(completeError)throw completeError;
          skipped+=1;
          continue;
        }

        const petSummaries=summarizePets(sendableMeals);
        const {title,body}=buildMessage(petSummaries);
        const localDate=first.local_date;
        const timezone=timezones.get(first.user_id)??"America/Sao_Paulo";
        const localTime=timeInZone(first.scheduled_at,timezone);
        const deepLink=buildDeepLink(localDate,localTime);

        const response=await fetch("https://api.onesignal.com/notifications",{
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            Authorization:`Key ${ONESIGNAL_REST_API_KEY}`,
          },
          body:JSON.stringify({
            app_id:ONESIGNAL_APP_ID,
            target_channel:"push",
            include_aliases:{external_id:[first.user_id]},
            headings:{pt:title,en:title},
            contents:{pt:body,en:body},
            url:deepLink,
            data:{view:"today",date:localDate,time:localTime,notification_group_id:claim.id},
            ttl:NOTIFICATION_TTL_SECONDS,
            web_push_topic:claim.id,
            idempotency_key:claim.idempotency_key,
            name:`Refeição ${localDate} ${localTime}`,
          }),
        });

        const responsePayload=await readResponsePayload(response);
        if(!response.ok){
          const message=`OneSignal ${response.status}: ${JSON.stringify(responsePayload)}`;
          await markGroupFailed(claim.id,message);
          console.error(message);
          failed+=1;
          continue;
        }

        const messageId=typeof responsePayload?.id==="string"?responsePayload.id:"";
        const occurrenceIdsForGroup=sendableMeals.map(meal=>meal.id);

        if(messageId){
          const {error:completeError}=await supabase.rpc("complete_meal_notification_group",{
            p_group_id:claim.id,
            p_status:"sent",
            p_message_id:messageId,
            p_occurrence_ids:occurrenceIdsForGroup,
            p_note:null,
          });
          if(completeError)throw completeError;
          sent+=1;
        }else{
          const note=`Nenhuma assinatura válida encontrada: ${JSON.stringify(responsePayload)}`;
          const {error:completeError}=await supabase.rpc("complete_meal_notification_group",{
            p_group_id:claim.id,
            p_status:"skipped",
            p_message_id:null,
            p_occurrence_ids:occurrenceIdsForGroup,
            p_note:note,
          });
          if(completeError)throw completeError;
          skipped+=1;
        }
      }catch(error){
        const message=error instanceof Error?error.message:String(error);
        await markGroupFailed(claim.id,message);
        console.error("Falha ao enviar grupo",message);
        failed+=1;
      }
    }

    return json({ok:true,groups:grouped.size,sent,skipped,failed});
  }catch(error){
    return json({ok:false,error:error instanceof Error?error.message:String(error)},500);
  }
});

function summarizePets(meals:RawMeal[]):PetSummary[]{
  const pets=new Map<string,{id:string;name:string;icon:string;items:Map<string,ItemSummary>}>();

  for(const meal of meals){
    const pet=one(meal.pets);
    const template=one(meal.meal_templates);
    const summary=pets.get(meal.pet_id)??{
      id:meal.pet_id,
      name:pet?.name??"Animal",
      icon:pet?.icon??"🐾",
      items:new Map<string,ItemSummary>(),
    };

    for(const component of template?.meal_components??[]){
      const food=one(component.foods);
      const name=food?.name??"alimento";
      const unit=component.unit;
      const key=`${name}|${unit}`;
      const current=summary.items.get(key);
      const quantity=Number(component.quantity);
      summary.items.set(key,{name,unit,quantity:(current?.quantity??0)+(Number.isFinite(quantity)?quantity:0)});
    }

    pets.set(meal.pet_id,summary);
  }

  return [...pets.values()].map(pet=>({...pet,items:[...pet.items.values()]}));
}

function buildMessage(pets:PetSummary[]){
  if(pets.length===1){
    const pet=pets[0];
    const title=fitTitle(`Hora da refeição — ${pet.icon} ${pet.name}`);
    const body=pickBody([
      pet.items.map(formatItem).join(" • "),
      compactItems(pet.items,2),
      compactItems(pet.items,1),
      `Confira os itens da refeição de ${pet.name} no Rotina Pet.`,
    ]);
    return{title,body};
  }

  if(pets.length===2){
    const title=fitTitle(`Refeição — ${pets[0].icon} ${pets[0].name} e ${pets[1].icon} ${pets[1].name}`);
    const body=pickBody([
      pets.map(pet=>`${pet.icon} ${pet.name}: ${pet.items.map(formatItem).join(" + ")}`).join(" • "),
      pets.map(pet=>`${pet.icon} ${pet.name}: ${compactItems(pet.items,2)}`).join(" • "),
      pets.map(pet=>`${pet.icon} ${pet.name}: ${compactItems(pet.items,1)}`).join(" • "),
      `${pets.map(pet=>`${pet.icon} ${pet.name}`).join(" e ")} têm refeições programadas agora.`,
    ]);
    return{title,body};
  }

  const title=fitTitle(`${pets.length} pets têm refeição agora`);
  const body=pickBody([
    pets.map(pet=>`${pet.icon} ${pet.name}: ${compactItems(pet.items,1)}`).join(" • "),
    `${pets.map(pet=>`${pet.icon} ${pet.name}`).join(", ")}. Toque para conferir os itens.`,
  ]);
  return{title,body};
}

function compactItems(items:ItemSummary[],visibleCount:number){
  if(!items.length)return"Confira os itens no aplicativo";
  const visible=items.slice(0,visibleCount).map(formatItem).join(" + ");
  const remaining=items.length-visibleCount;
  return remaining>0?`${visible} + ${remaining} ${remaining===1?"item":"itens"}`:visible;
}

function formatItem(item:ItemSummary){
  const quantity=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(item.quantity);
  return `${quantity} ${UNIT_LABELS[item.unit]??item.unit} de ${item.name}`;
}

function fitTitle(title:string){
  return title.length<=72?title:`${title.slice(0,69).trimEnd()}…`;
}

function pickBody(candidates:string[]){
  const meaningful=candidates.filter(Boolean);
  const fitting=meaningful.find(candidate=>candidate.length<=MAX_BODY_LENGTH);
  if(fitting)return fitting;
  const fallback=meaningful.at(-1)??"Confira a refeição no Rotina Pet.";
  return `${fallback.slice(0,MAX_BODY_LENGTH-1).trimEnd()}…`;
}

function timeInZone(iso:string,timeZone:string){
  try{
    const parts=new Intl.DateTimeFormat("en-GB",{
      timeZone,
      hour:"2-digit",
      minute:"2-digit",
      hourCycle:"h23",
    }).formatToParts(new Date(iso));
    const hour=parts.find(part=>part.type==="hour")?.value;
    const minute=parts.find(part=>part.type==="minute")?.value;
    if(hour&&minute)return`${hour}:${minute}`;
  }catch(error){
    console.error(`Fuso inválido para o deep link: ${timeZone}`,error);
  }
  return"00:00";
}

function buildDeepLink(date:string,time:string){
  const base=APP_PUBLIC_URL.endsWith("/")?APP_PUBLIC_URL:`${APP_PUBLIC_URL}/`;
  const url=new URL(base);
  url.searchParams.set("view","today");
  url.searchParams.set("date",date);
  url.searchParams.set("time",time);
  return url.toString();
}

async function markGroupFailed(groupId:string,error:string){
  const {error:rpcError}=await supabase.rpc("fail_meal_notification_group",{
    p_group_id:groupId,
    p_error:error,
  });
  if(rpcError)console.error("Falha ao registrar erro do grupo",rpcError);
}

async function readResponsePayload(response:Response):Promise<any>{
  const text=await response.text();
  if(!text)return{};
  try{return JSON.parse(text);}catch{return{text};}
}

function one<T>(value:T|T[]|null|undefined):T|null{
  return Array.isArray(value)?value[0]??null:value??null;
}

function readPositiveInteger(name:string,fallback:number){
  const value=Number(Deno.env.get(name));
  return Number.isInteger(value)&&value>0?value:fallback;
}

function json(payload:unknown,status=200){
  return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json"}});
}
