import {useMemo} from "react";
import type {MealOccurrence,Pet} from "../types";
import {numberPt,timePt,unitLabels} from "../lib/format";

function statusOf(meal:MealOccurrence){
  const late=meal.status==="pending"&&new Date(meal.scheduled_at).getTime()<Date.now();
  if(meal.status==="completed")return{label:"Concluída",className:"completed"};
  if(meal.status==="skipped")return{label:"Não realizada",className:"skipped"};
  if(late)return{label:"Atrasada",className:"late"};
  return{label:"Pendente",className:"pending"};
}

export function TodayPage({pets,meals,selectedPetIds,loading,onToggle,onSkip,onOpenPlan,onOpenPets}:{pets:Pet[];meals:MealOccurrence[];selectedPetIds:string[];loading:boolean;onToggle:(meal:MealOccurrence)=>void;onSkip:(meal:MealOccurrence)=>void;onOpenPlan:(petId?:string)=>void;onOpenPets:()=>void}){
  const petById=useMemo(()=>new Map(pets.map(pet=>[pet.id,pet])),[pets]);
  const filteredMeals=useMemo(()=>meals.filter(meal=>selectedPetIds.includes(meal.pet_id)),[meals,selectedPetIds]);
  const groups=useMemo(()=>{
    const grouped=new Map<string,MealOccurrence[]>();
    for(const meal of filteredMeals){
      const time=timePt(meal.scheduled_at);
      grouped.set(time,[...(grouped.get(time)??[]),meal]);
    }
    return [...grouped.entries()];
  },[filteredMeals]);
  const completed=filteredMeals.filter(meal=>meal.status==="completed").length;
  const progress=filteredMeals.length?Math.round(completed/filteredMeals.length*100):0;
  const selectedPets=pets.filter(pet=>selectedPetIds.includes(pet.id));
  const dateLabel=new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  const normalizedDate=dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1);

  if(loading)return <section className="empty-card"><div className="spinner"/><p>Organizando as refeições de hoje…</p></section>;
  if(!pets.length)return <section className="empty-card"><span className="empty-symbol">◇</span><h2>Nenhum animal ativo</h2><p>Restaure um perfil arquivado ou cadastre um novo animal para montar a rotina.</p><button className="primary-button" onClick={onOpenPets}>Abrir animais</button></section>;
  if(!filteredMeals.length){
    const onlyPet=selectedPets.length===1?selectedPets[0]:undefined;
    return <section className="empty-card"><span className="empty-symbol">○</span><h2>Nenhuma refeição programada</h2><p>{onlyPet?`Crie o plano alimentar de ${onlyPet.name} para gerar o cronograma diário.`:"Os animais selecionados ainda não têm refeições para hoje."}</p><button className="primary-button" onClick={()=>onOpenPlan(onlyPet?.id??selectedPets[0]?.id)}>Criar plano</button></section>;
  }

  return <section className="today-page">
    <article className="today-overview">
      <div><p className="eyebrow">{normalizedDate}</p><h2>{completed} de {filteredMeals.length} refeições concluídas</h2><p className="muted">A rotina de todos os animais selecionados, em ordem de horário.</p></div>
      <div className="progress-summary" aria-label={`${progress}% concluído`}><strong>{progress}%</strong><span><i style={{width:`${progress}%`}}/></span></div>
    </article>

    <div className="time-groups">
      {groups.map(([time,groupMeals])=><section className="time-group" key={time}>
        <header className="time-group-heading"><h2>{time}</h2><span>{groupMeals.length===1?"1 refeição":`${groupMeals.length} refeições`}</span></header>
        <div className="time-group-cards">
          {groupMeals.map(meal=>{
            const mealPet=petById.get(meal.pet_id);
            const state=statusOf(meal);
            const done=meal.status==="completed";
            const skipped=meal.status==="skipped";
            const components=meal.meal_templates?.meal_components??[];
            return <article key={meal.id} className={`meal-card ${state.className}`}>
              <header className="meal-card-header">
                <div className="meal-pet"><span className="meal-pet-icon">{mealPet?.icon??"🐾"}</span><div><strong>{mealPet?.name??"Animal"}</strong><span>Refeição das {time}</span></div></div>
                <span className={`status-pill ${state.className}`}>{state.label}</span>
              </header>

              <div className="meal-components">
                {components.map(component=><div className="meal-component-row" key={component.id}><div><span className="component-label">Alimento</span><strong>{component.foods?.name??"Alimento"}</strong></div><span className="component-quantity">{numberPt(component.quantity)} {unitLabels[component.unit]}</span></div>)}
              </div>

              <footer className="meal-card-actions">
                <div className="meal-completion-note">{meal.completed_at?`Concluída às ${timePt(meal.completed_at)}`:skipped?"Esta refeição não foi realizada.":""}</div>
                <div className="meal-action-buttons"><button className={`meal-complete-button ${done?"is-done":""}`} onClick={()=>onToggle(meal)}>{done?"✓ Concluída":"Marcar como concluída"}</button><button className="more-button" onClick={()=>onSkip(meal)} title={skipped?"Voltar para pendente":"Marcar como não realizada"} aria-label={skipped?"Voltar para pendente":"Marcar como não realizada"}>•••</button></div>
              </footer>
            </article>;
          })}
        </div>
      </section>)}
    </div>
  </section>;
}
