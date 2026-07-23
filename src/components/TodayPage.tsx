import {useEffect,useMemo,useRef,useState} from "react";
import type {MealConsumptionLevel,MealOccurrence,MealOutcome,Pet} from "../types";
import {formatLocalDateLong,numberPt,timePt,unitLabels} from "../lib/format";

type StatusIconName="check"|"clock"|"pending"|"close";

type MealVisualState={
  label:string;
  className:"completed"|"partial"|"not-eaten"|"skipped"|"late"|"pending";
  icon:StatusIconName;
};

type PendingFutureOutcome={
  meal:MealOccurrence;
  outcome:MealOutcome;
  time:string;
};

const consumptionLabels:Record<MealConsumptionLevel,string>={
  full:"Comeu tudo",
  almost:"Quase tudo",
  half:"Metade",
  little:"Pouco",
  none:"Não comeu",
};

const partialOptions:{value:Exclude<MealConsumptionLevel,"full">;label:string;description:string}[]=[
  {value:"almost",label:"Quase tudo",description:"Sobrou só um pouco"},
  {value:"half",label:"Metade",description:"Comeu aproximadamente metade"},
  {value:"little",label:"Pouco",description:"Comeu só uma pequena parte"},
  {value:"none",label:"Nada",description:"A comida foi oferecida, mas não comeu"},
];

function StatusIcon({name}:{name:StatusIconName}){
  if(name==="check")return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.2 3.3 3.3 7.7-8"/></svg>;
  if(name==="clock")return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5v4l2.7 1.6"/></svg>;
  if(name==="close")return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>;
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/></svg>;
}

function statusOf(meal:MealOccurrence):MealVisualState{
  const late=meal.status==="pending"&&new Date(meal.scheduled_at).getTime()<Date.now();
  if(meal.status==="completed"){
    const consumption=meal.consumption_level??"full";
    if(consumption==="full")return{label:consumptionLabels[consumption],className:"completed",icon:"check"};
    if(consumption==="none")return{label:consumptionLabels[consumption],className:"not-eaten",icon:"check"};
    return{label:consumptionLabels[consumption],className:"partial",icon:"check"};
  }
  if(meal.status==="skipped")return{label:"Não foi servida",className:"skipped",icon:"close"};
  if(late)return{label:"Atrasada",className:"late",icon:"clock"};
  return{label:"Pendente",className:"pending",icon:"pending"};
}

function groupId(time:string){return `refeicoes-${time.replace(":","-")}`;}

function registeredLabel(count:number,total:number){
  if(total===1)return count===1?"Registrada":"Pendente";
  return `${count} de ${total} registradas`;
}

function futureDistanceLabel(scheduledAt:string){
  const remaining=Math.max(0,new Date(scheduledAt).getTime()-Date.now());
  const totalMinutes=Math.ceil(remaining/60000);
  const days=Math.floor(totalMinutes/1440);
  const hours=Math.floor((totalMinutes%1440)/60);
  const minutes=totalMinutes%60;
  const parts:string[]=[];
  if(days)parts.push(`${days}d`);
  if(hours)parts.push(`${hours}h`);
  if(minutes||!parts.length)parts.push(`${minutes}min`);
  return parts.join(" ");
}

export function TodayPage({
  pets,
  meals,
  selectedPetIds,
  loading,
  onSetOutcome,
  onOpenPlan,
  onOpenPets,
  displayDate,
  isToday,
  canGoForward,
  onPreviousDay,
  onNextDay,
  onGoToToday,
  timezone,
  focusTime,
  onFocusHandled,
}:{
  pets:Pet[];
  meals:MealOccurrence[];
  selectedPetIds:string[];
  loading:boolean;
  onSetOutcome:(meal:MealOccurrence,outcome:MealOutcome)=>Promise<void>;
  onOpenPlan:(petId?:string)=>void;
  onOpenPets:()=>void;
  displayDate:string;
  isToday:boolean;
  canGoForward:boolean;
  onPreviousDay:()=>void;
  onNextDay:()=>void;
  onGoToToday:()=>void;
  timezone:string;
  focusTime:string|null;
  onFocusHandled:()=>void;
}){
  const[openMealByTime,setOpenMealByTime]=useState<Record<string,string|undefined>>({});
  const[consumptionPickerId,setConsumptionPickerId]=useState<string|null>(null);
  const[busyMealId,setBusyMealId]=useState<string|null>(null);
  const[focusedTime,setFocusedTime]=useState<string|null>(null);
  const[pendingFutureOutcome,setPendingFutureOutcome]=useState<PendingFutureOutcome|null>(null);
  const focusTimer=useRef<number|undefined>(undefined);
  const petById=useMemo(()=>new Map(pets.map(pet=>[pet.id,pet])),[pets]);
  const filteredMeals=useMemo(()=>meals.filter(meal=>selectedPetIds.includes(meal.pet_id)),[meals,selectedPetIds]);
  const groups=useMemo(()=>{
    const grouped=new Map<string,MealOccurrence[]>();
    for(const meal of filteredMeals){
      const time=timePt(meal.scheduled_at,timezone);
      grouped.set(time,[...(grouped.get(time)??[]),meal]);
    }
    return [...grouped.entries()];
  },[filteredMeals,timezone]);
  const registered=filteredMeals.filter(meal=>meal.status!=="pending").length;
  const progress=filteredMeals.length?Math.round(registered/filteredMeals.length*100):0;
  const selectedPets=pets.filter(pet=>selectedPetIds.includes(pet.id));
  const normalizedDate=formatLocalDateLong(displayDate);

  useEffect(()=>{
    if(loading||!focusTime)return;
    const target=groups.find(([time])=>time===focusTime);
    if(!target){onFocusHandled();return;}
    const[,groupMeals]=target;
    const firstPending=groupMeals.find(meal=>meal.status==="pending")??groupMeals[0];
    if(firstPending)setOpenMealByTime(current=>({...current,[focusTime]:firstPending.id}));
    setFocusedTime(focusTime);
    window.requestAnimationFrame(()=>document.getElementById(groupId(focusTime))?.scrollIntoView({behavior:"smooth",block:"start"}));
    clearTimeout(focusTimer.current);
    focusTimer.current=window.setTimeout(()=>setFocusedTime(null),4500);
    onFocusHandled();
  },[focusTime,groups,loading,onFocusHandled]);

  useEffect(()=>()=>clearTimeout(focusTimer.current),[]);

  function toggleMeal(time:string,mealId:string){
    setOpenMealByTime(current=>({...current,[time]:current[time]===mealId?undefined:mealId}));
    setConsumptionPickerId(null);
  }

  function scrollToTime(time:string){
    document.getElementById(groupId(time))?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  async function performOutcome(meal:MealOccurrence,outcome:MealOutcome,time:string){
    setBusyMealId(meal.id);
    try{
      await onSetOutcome(meal,outcome);
      setOpenMealByTime(current=>({...current,[time]:undefined}));
      setConsumptionPickerId(null);
    }finally{
      setBusyMealId(null);
    }
  }

  function requestOutcome(meal:MealOccurrence,outcome:MealOutcome,time:string){
    const isFuture=outcome!=="pending"&&new Date(meal.scheduled_at).getTime()>Date.now();
    if(isFuture){
      setPendingFutureOutcome({meal,outcome,time});
      return;
    }
    void performOutcome(meal,outcome,time);
  }

  function confirmFutureOutcome(){
    if(!pendingFutureOutcome)return;
    const request=pendingFutureOutcome;
    setPendingFutureOutcome(null);
    void performOutcome(request.meal,request.outcome,request.time);
  }

  if(loading)return <section className="empty-card"><div className="spinner"/><p>{isToday?"Organizando as refeições de hoje…":`Buscando o histórico de ${normalizedDate.toLowerCase()}…`}</p></section>;
  if(!pets.length)return <section className="empty-card"><span className="empty-symbol">◇</span><h2>Nenhum animal ativo</h2><p>Restaure um perfil arquivado ou cadastre um novo animal para montar a rotina.</p><button className="primary-button" onClick={onOpenPets}>Abrir animais</button></section>;
  if(!filteredMeals.length){
    const onlyPet=selectedPets.length===1?selectedPets[0]:undefined;
    const emptyMessage=isToday
      ?(onlyPet?`Crie o plano alimentar de ${onlyPet.name} para gerar o cronograma diário.`:"Os animais selecionados ainda não têm refeições para hoje.")
      :(onlyPet?`${onlyPet.name} não tinha refeições registradas nessa data.`:"Os animais selecionados não têm refeições registradas nessa data.");
    return <section className="empty-card"><span className="empty-symbol">○</span><h2>{isToday?"Nenhuma refeição programada":"Nenhum registro nessa data"}</h2><p>{emptyMessage}</p>{isToday?<button className="primary-button" onClick={()=>onOpenPlan(onlyPet?.id??selectedPets[0]?.id)}>Criar plano</button>:<button className="secondary-button" onClick={onGoToToday}>Voltar para hoje</button>}</section>;
  }

  return <section className="today-page">
    <article className="today-overview">
      <div className="today-overview-top">
        <div>
          <p className="eyebrow">{isToday?"Hoje":"Histórico"}</p>
          <h2>{registered} de {filteredMeals.length} refeições registradas</h2>
          <p className="muted">Veja os horários do dia e abra apenas a refeição que precisa consultar.</p>
        </div>
        <div className="progress-summary" aria-label={`${progress}% registrado`}><strong>{progress}%</strong><span><i style={{width:`${progress}%`}}/></span></div>
      </div>

      <div className="date-navigator" aria-label="Alterar dia exibido">
        <button className="secondary-button compact icon-button" onClick={onPreviousDay} aria-label="Ver dia anterior">‹</button>
        <div className="date-navigator-summary"><strong>{normalizedDate}</strong><span>{isToday?"Acompanhamento de hoje":"Refeições e registros deste dia"}</span></div>
        <div className="date-navigator-actions">
          {!isToday&&<button className="secondary-button compact" onClick={onGoToToday}>Voltar para hoje</button>}
          <button className="secondary-button compact icon-button" onClick={onNextDay} disabled={!canGoForward} aria-label="Ver dia seguinte">›</button>
        </div>
      </div>

      <div className="today-time-summary">
        <p className="eyebrow">Horários do dia</p>
        <nav className="today-time-nav" aria-label="Ir para um horário de refeição">
          {groups.map(([time,groupMeals])=>{
            const groupRegistered=groupMeals.filter(meal=>meal.status!=="pending").length;
            return <button key={time} className={groupRegistered===groupMeals.length?"complete":""} onClick={()=>scrollToTime(time)}><strong>{time}</strong><span>{groupRegistered}/{groupMeals.length}</span></button>;
          })}
        </nav>
      </div>
    </article>

    <div className="time-groups">
      {groups.map(([time,groupMeals])=>{
        const groupRegistered=groupMeals.filter(meal=>meal.status!=="pending").length;
        return <section className={`time-group ${focusedTime===time?"deep-link-highlight":""}`} id={groupId(time)} key={time}>
          <header className="time-group-heading"><h2>{time}</h2><span>{registeredLabel(groupRegistered,groupMeals.length)}</span></header>
          <div className="time-group-list">
            {groupMeals.map(meal=>{
              const mealPet=petById.get(meal.pet_id);
              const state=statusOf(meal);
              const components=meal.meal_templates?.meal_components??[];
              const open=openMealByTime[time]===meal.id;
              const busy=busyMealId===meal.id;
              const consumption=meal.status==="completed"?(meal.consumption_level??"full"):null;
              return <article key={meal.id} className={`meal-accordion ${state.className} ${open?"is-open":""}`}>
                <button className="meal-accordion-trigger" type="button" aria-expanded={open} aria-controls={`meal-details-${meal.id}`} onClick={()=>toggleMeal(time,meal.id)}>
                  <span className="meal-pet-icon">{mealPet?.icon??"🐾"}</span>
                  <strong className="meal-pet-name">{mealPet?.name??"Animal"}</strong>
                  <span className={`status-pill ${state.className}`}><span className="status-icon"><StatusIcon name={state.icon}/></span>{state.label}</span>
                  <span className="accordion-chevron" aria-hidden="true">⌄</span>
                </button>

                {open&&<div className="meal-accordion-panel" id={`meal-details-${meal.id}`}>
                  <div className="meal-components">
                    {components.map(component=><div className="meal-component-row" key={component.id}><div><span className="component-label">Alimento</span><strong>{component.foods?.name??"Alimento"}</strong></div><span className="component-quantity">{numberPt(component.quantity)} {unitLabels[component.unit]}</span></div>)}
                  </div>

                  <div className="meal-record-summary plain-text-summary">
                    {meal.status==="completed"&&<p><strong>{consumption?consumptionLabels[consumption]:"Comeu tudo"}</strong>{meal.completed_at?` · registrado às ${timePt(meal.completed_at,timezone)}`:""}</p>}
                    {meal.status==="skipped"&&<p><strong>Não foi servida.</strong> A refeição ficou registrada como não oferecida.</p>}
                    {meal.status==="pending"&&<p>{state.className==="late"?"O horário já passou e ainda não há registro.":"Escolha o que aconteceu quando a refeição for oferecida."}</p>}
                  </div>

                  <div className="meal-outcome-actions" aria-label="Registrar resultado da refeição">
                    <button disabled={busy} className={`outcome-button eat-all ${consumption==="full"?"is-selected":""}`} onClick={()=>requestOutcome(meal,"full",time)}>Comeu tudo</button>
                    <button disabled={busy} className={`outcome-button partial-consumption ${consumption&&consumption!=="full"?"is-selected":""}`} aria-expanded={consumptionPickerId===meal.id} onClick={()=>setConsumptionPickerId(current=>current===meal.id?null:meal.id)}>Não comeu tudo</button>
                    <button disabled={busy} className={`outcome-button not-served ${meal.status==="skipped"?"is-selected":""}`} onClick={()=>requestOutcome(meal,"not_served",time)}>Não servida</button>
                  </div>

                  {consumptionPickerId===meal.id&&<div className="consumption-picker">
                    <div><p className="eyebrow">Quanto comeu?</p><p className="muted">Escolha a aproximação que melhor descreve a refeição.</p></div>
                    <div className="consumption-options">
                      {partialOptions.map(option=><button key={option.value} disabled={busy} className={consumption===option.value?"is-selected":""} onClick={()=>requestOutcome(meal,option.value,time)}><strong>{option.label}</strong><span>{option.description}</span></button>)}
                    </div>
                  </div>}

                  {meal.status!=="pending"&&<button className="reset-meal-button" disabled={busy} onClick={()=>requestOutcome(meal,"pending",time)}>Desfazer registro</button>}
                </div>}
              </article>;
            })}
          </div>
        </section>;
      })}
    </div>

    {pendingFutureOutcome&&<div className="alert-sheet-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPendingFutureOutcome(null);}}>
      <section className="alert-sheet" role="alertdialog" aria-modal="true" aria-labelledby="future-meal-title" aria-describedby="future-meal-description">
        <div className="alert-sheet-handle" aria-hidden="true"/>
        <p className="eyebrow">Confirmar registro antecipado</p>
        <h2 id="future-meal-title">Esta refeição ainda está programada para mais tarde</h2>
        <p id="future-meal-description">Você está marcando como registrada uma refeição programada para <strong>{timePt(pendingFutureOutcome.meal.scheduled_at,timezone)}</strong> (daqui {futureDistanceLabel(pendingFutureOutcome.meal.scheduled_at)}). Tem certeza de que deseja continuar?</p>
        <p className="alert-sheet-note">O Rotina Pet não impede o registro antecipado. Esta confirmação existe apenas para ajudar a evitar marcações por engano.</p>
        <div className="alert-sheet-actions">
          <button className="secondary-button" type="button" onClick={()=>setPendingFutureOutcome(null)}>Cancelar</button>
          <button className="primary-button" type="button" onClick={confirmFutureOutcome}>Sim, continuar</button>
        </div>
      </section>
    </div>}
  </section>;
}
