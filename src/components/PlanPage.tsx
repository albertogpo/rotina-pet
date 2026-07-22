import {useEffect,useMemo,useState} from "react";
import {datePt,generateEvenTimes,numberPt,unitLabels} from "../lib/format";
import type {Food,FoodUnit,Pet,PlanFoodInput} from "../types";

const units=Object.keys(unitLabels) as FoodUnit[];
type TimeMode="window"|"manual";

function normalizeTime(value:string){
  return value.slice(0,5);
}

function minutesOf(time:string){
  const[hours,minutes]=time.split(":").map(Number);
  return hours*60+minutes;
}

function validateTimes(times:string[]){
  if(!times.length||times.some(time=>!time))return "Revise os horários.";
  if(new Set(times).size!==times.length)return "Os horários não podem se repetir.";
  for(let index=1;index<times.length;index++){
    if(minutesOf(times[index])<=minutesOf(times[index-1]))return "Os horários precisam estar em ordem, do mais cedo para o mais tarde.";
  }
  return "";
}

export function PlanPage({pet,foods,activePlan,onSave,onUpdateSchedule,onCreateFood,today}:{
  pet:Pet;
  foods:Food[];
  activePlan:any;
  onSave:(input:{name:string;startsOn:string;mealTimes:string[];foods:PlanFoodInput[]})=>Promise<void>;
  onUpdateSchedule:(planId:string,startsOn:string,mealTimes:string[])=>Promise<void>;
  onCreateFood:(name:string,unit:FoodUnit)=>Promise<Food>;
  today:string;
}){
  const[name,setName]=useState("Plano alimentar");
  const[startsOn,setStartsOn]=useState(today);
  const[count,setCount]=useState(4);
  const[mode,setMode]=useState<TimeMode>("window");
  const[windowStart,setWindowStart]=useState("07:00");
  const[windowEnd,setWindowEnd]=useState("22:00");
  const[manualTimes,setManualTimes]=useState(["07:00","12:00","17:00","22:00"]);
  const[rows,setRows]=useState<PlanFoodInput[]>([]);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[saved,setSaved]=useState("");
  const[creatingFood,setCreatingFood]=useState(false);
  const[newFoodName,setNewFoodName]=useState("");
  const[newFoodUnit,setNewFoodUnit]=useState<FoodUnit>("g");
  const[foodBusy,setFoodBusy]=useState(false);
  const[foodError,setFoodError]=useState("");

  const[editingSchedule,setEditingSchedule]=useState(false);
  const[scheduleStartsOn,setScheduleStartsOn]=useState(today);
  const[scheduleMode,setScheduleMode]=useState<TimeMode>("manual");
  const[scheduleWindowStart,setScheduleWindowStart]=useState("07:00");
  const[scheduleWindowEnd,setScheduleWindowEnd]=useState("22:00");
  const[scheduleManualTimes,setScheduleManualTimes]=useState<string[]>([]);
  const[scheduleBusy,setScheduleBusy]=useState(false);
  const[scheduleError,setScheduleError]=useState("");


  useEffect(()=>{
    setStartsOn(current=>current<today?today:current);
    setScheduleStartsOn(current=>current<today?today:current);
  },[today]);

  const currentPlanTimes=useMemo(()=>{
    return [...(activePlan?.meal_templates??[])]
      .sort((a:any,b:any)=>a.sequence-b.sequence)
      .map((template:any)=>normalizeTime(template.scheduled_time));
  },[activePlan]);

  const currentPlanFoods=useMemo(()=>{
    return [...(activePlan?.plan_foods??[])].map((planFood:any)=>({
      id:planFood.id,
      name:planFood.foods?.name??"Alimento",
      quantity:Number(planFood.daily_quantity),
      unit:planFood.unit as FoodUnit,
      meals:Array.isArray(planFood.meal_sequences)?planFood.meal_sequences.length:0,
    }));
  },[activePlan]);

  useEffect(()=>{
    setManualTimes(current=>Array.from({length:count},(_,index)=>current[index]??"12:00"));
    setRows(current=>current.map(row=>{
      const valid=row.mealSequences.filter(sequence=>sequence<=count);
      return{...row,mealSequences:valid.length?valid:Array.from({length:count},(_,index)=>index+1)};
    }));
  },[count]);

  useEffect(()=>{
    if(!activePlan)return;
    const times=currentPlanTimes;
    setScheduleStartsOn(today);
    setScheduleMode("manual");
    setScheduleManualTimes(times);
    setScheduleWindowStart(times[0]??"07:00");
    setScheduleWindowEnd(times.at(-1)??"22:00");
    setScheduleError("");
    setEditingSchedule(false);
  },[activePlan?.id,currentPlanTimes.join("|")]);

  const suggested=useMemo(()=>{try{return generateEvenTimes(windowStart,windowEnd,count);}catch{return[];}},[windowStart,windowEnd,count]);
  const times=mode==="window"?suggested:manualTimes;
  const scheduleCount=currentPlanTimes.length;
  const scheduleSuggested=useMemo(()=>{
    try{return generateEvenTimes(scheduleWindowStart,scheduleWindowEnd,scheduleCount);}catch{return[];}
  },[scheduleWindowStart,scheduleWindowEnd,scheduleCount]);
  const scheduleTimes=scheduleMode==="window"?scheduleSuggested:scheduleManualTimes;

  function openScheduleEditor(){
    setScheduleStartsOn(today);
    setScheduleMode("manual");
    setScheduleManualTimes(currentPlanTimes);
    setScheduleWindowStart(currentPlanTimes[0]??"07:00");
    setScheduleWindowEnd(currentPlanTimes.at(-1)??"22:00");
    setScheduleError("");
    setEditingSchedule(true);
  }

  function appendFood(food:Food){
    setRows(current=>current.some(row=>row.foodId===food.id)?current:[...current,{foodId:food.id,dailyQuantity:"",unit:food.default_unit,mealSequences:Array.from({length:count},(_,index)=>index+1)}]);
  }

  function addExistingFood(){
    const food=foods.find(item=>!rows.some(row=>row.foodId===item.id));
    if(food)appendFood(food);
  }

  function patch(index:number,patchValue:Partial<PlanFoodInput>){
    setRows(current=>current.map((row,rowIndex)=>rowIndex===index?{...row,...patchValue}:row));
  }

  function toggle(index:number,sequence:number){
    const row=rows[index];
    const next=row.mealSequences.includes(sequence)?row.mealSequences.filter(item=>item!==sequence):[...row.mealSequences,sequence].sort((a,b)=>a-b);
    patch(index,{mealSequences:next});
  }

  async function createFoodInline(){
    if(!newFoodName.trim()){setFoodError("Informe o nome do alimento.");return;}
    setFoodBusy(true);
    setFoodError("");
    try{
      const created=await onCreateFood(newFoodName.trim(),newFoodUnit);
      appendFood(created);
      setNewFoodName("");
      setNewFoodUnit("g");
      setCreatingFood(false);
    }catch(err){
      setFoodError(err instanceof Error?err.message:"Não foi possível cadastrar o alimento.");
    }finally{
      setFoodBusy(false);
    }
  }

  async function submitSchedule(event:React.FormEvent){
    event.preventDefault();
    setScheduleError("");
    if(!activePlan)return;
    const timeError=validateTimes(scheduleTimes);
    if(timeError){setScheduleError(timeError);return;}
    setScheduleBusy(true);
    try{
      await onUpdateSchedule(activePlan.id,scheduleStartsOn,scheduleTimes);
    }catch(err){
      setScheduleError(err instanceof Error?err.message:"Não foi possível atualizar os horários.");
    }finally{
      setScheduleBusy(false);
    }
  }

  async function submit(event:React.FormEvent){
    event.preventDefault();
    setError("");
    setSaved("");
    const timeError=validateTimes(times);
    if(timeError){setError(timeError);return;}
    if(!rows.length){setError("Adicione ao menos um alimento.");return;}
    for(const row of rows){
      const quantity=Number(row.dailyQuantity.replace(",","."));
      if(!Number.isFinite(quantity)||quantity<=0){setError("Informe uma quantidade diária válida para todos os alimentos.");return;}
      if(!row.mealSequences.length){setError("Cada alimento precisa aparecer em pelo menos uma refeição.");return;}
    }
    setBusy(true);
    try{
      await onSave({name:name.trim()||"Plano alimentar",startsOn,mealTimes:times,foods:rows});
      setSaved("Plano salvo.");
    }catch(err){
      setError(err instanceof Error?err.message:"Não foi possível salvar o plano.");
    }finally{
      setBusy(false);
    }
  }

  return <section className="page-grid">
    {activePlan&&<article className="current-plan">
      <div><p className="eyebrow">Plano atual de {pet.name}</p><h2>{activePlan.name}</h2><p>Válido desde {datePt(activePlan.starts_on)}</p></div>
      <div className="current-plan-actions"><span>{currentPlanTimes.length} refeições/dia</span><button type="button" className="secondary-button compact" onClick={openScheduleEditor}>Editar horários</button></div>
    </article>}

    {activePlan&&editingSchedule&&<article className="panel-card schedule-editor-card">
      <div className="section-heading">
        <div><p className="eyebrow">Rotina</p><h2>Editar horários</h2><p className="muted readable">Alimentos, quantidades diárias e divisão das porções serão mantidos exatamente como estão.</p></div>
        <button type="button" className="secondary-button compact" onClick={()=>setEditingSchedule(false)}>Cancelar</button>
      </div>

      <form className="stack-form" onSubmit={submitSchedule}>
        <label>Aplicar os novos horários a partir de<input type="date" min={today} required value={scheduleStartsOn} onChange={event=>setScheduleStartsOn(event.target.value)}/></label>
        <p className="notice">Caso já existam refeições concluídas ou marcadas como não servidas nessa data, escolha uma data posterior para preservar o histórico.</p>

        <div className="segmented"><button type="button" className={scheduleMode==="window"?"active":""} onClick={()=>setScheduleMode("window")}>Distribuir por janela</button><button type="button" className={scheduleMode==="manual"?"active":""} onClick={()=>setScheduleMode("manual")}>Definir horários</button></div>

        {scheduleMode==="window"?<>
          <div className="form-grid"><label>Primeira refeição<input type="time" value={scheduleWindowStart} onChange={event=>setScheduleWindowStart(event.target.value)}/></label><label>Última refeição<input type="time" value={scheduleWindowEnd} onChange={event=>setScheduleWindowEnd(event.target.value)}/></label></div>
          <div className="time-preview">{scheduleSuggested.map((time,index)=><span key={index}>{time}</span>)}</div>
        </>:<div className="manual-times schedule-manual-times">{scheduleManualTimes.map((time,index)=><label key={index}>Refeição {index+1}<input type="time" value={time} onChange={event=>setScheduleManualTimes(current=>current.map((value,itemIndex)=>itemIndex===index?event.target.value:value))}/></label>)}</div>}

        <section className="preserved-plan-summary" aria-label="Itens que serão mantidos">
          <div><p className="eyebrow">Sem alterações</p><h3>Composição do plano</h3></div>
          <div className="preserved-plan-list">{currentPlanFoods.map(item=><div key={item.id}><strong>{item.name}</strong><span>{numberPt(item.quantity)} {unitLabels[item.unit]} por dia · divididos em {item.meals} {item.meals===1?"refeição":"refeições"}</span></div>)}</div>
        </section>

        {scheduleError&&<p className="error-box">{scheduleError}</p>}
        <button className="primary-button" disabled={scheduleBusy}>{scheduleBusy?"Salvando horários…":"Salvar novos horários"}</button>
      </form>
    </article>}

    <article className="panel-card">
      <p className="eyebrow">Plano nutricional</p><h2>{activePlan?"Criar uma nova versão completa":"Criar plano alimentar"}</h2><p className="muted readable">{activePlan?"Use esta área apenas quando também quiser mudar alimentos, quantidades ou o número de refeições. Para mudar somente os horários, use o botão acima.":"Defina os alimentos, as quantidades diárias e como serão divididos ao longo do dia."}</p>
      <form className="stack-form" onSubmit={submit}>
        <div className="form-grid"><label>Nome do plano<input value={name} onChange={event=>setName(event.target.value)}/></label><label>Início<input type="date" min={today} required value={startsOn} onChange={event=>setStartsOn(event.target.value)}/></label></div>
        <label>Refeições por dia<select value={count} onChange={event=>setCount(Number(event.target.value))}>{[1,2,3,4,5,6,7,8].map(number=><option key={number} value={number}>{number}</option>)}</select></label>
        <div className="segmented"><button type="button" className={mode==="window"?"active":""} onClick={()=>setMode("window")}>Distribuir por janela</button><button type="button" className={mode==="manual"?"active":""} onClick={()=>setMode("manual")}>Definir horários</button></div>
        {mode==="window"?<><div className="form-grid"><label>Primeira refeição<input type="time" value={windowStart} onChange={event=>setWindowStart(event.target.value)}/></label><label>Última refeição<input type="time" value={windowEnd} onChange={event=>setWindowEnd(event.target.value)}/></label></div><div className="time-preview">{suggested.map((time,index)=><span key={index}>{time}</span>)}</div></>:<div className="manual-times">{manualTimes.map((time,index)=><label key={index}>Refeição {index+1}<input type="time" value={time} onChange={event=>setManualTimes(current=>current.map((value,itemIndex)=>itemIndex===index?event.target.value:value))}/></label>)}</div>}

        <div className="section-heading composition-heading"><div><h3>Composição diária</h3><p className="muted">Escolha em quais refeições cada alimento será dividido.</p></div><div className="heading-actions">{foods.length>0&&<button type="button" className="secondary-button" onClick={addExistingFood} disabled={rows.length===foods.length}>＋ Adicionar existente</button>}<button type="button" className={foods.length?"link-button outlined-link":"primary-button compact"} onClick={()=>{setCreatingFood(true);setFoodError("");}}>{foods.length?"Novo alimento":"Cadastrar alimento"}</button></div></div>

        {creatingFood&&<section className="inline-food-form" aria-label="Cadastrar alimento sem sair do plano"><div><p className="eyebrow">Sem sair do plano</p><h3>Novo alimento</h3><p className="muted">Tudo que você já preencheu continuará aqui.</p></div><div className="form-grid"><label>Nome<input autoFocus required value={newFoodName} onChange={event=>setNewFoodName(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void createFoodInline();}}} placeholder="Ex.: Patê renal"/></label><label>Unidade padrão<select value={newFoodUnit} onChange={event=>setNewFoodUnit(event.target.value as FoodUnit)}>{units.map(unit=><option key={unit} value={unit}>{unitLabels[unit]}</option>)}</select></label></div>{foodError&&<p className="error-box">{foodError}</p>}<div className="button-row"><button type="button" className="primary-button compact" disabled={foodBusy||!newFoodName.trim()} onClick={()=>void createFoodInline()}>{foodBusy?"Cadastrando…":"Cadastrar e adicionar"}</button><button type="button" className="secondary-button compact" onClick={()=>{setCreatingFood(false);setFoodError("");}}>Cancelar</button></div></section>}

        {!foods.length&&!creatingFood&&<p className="notice">Nenhum alimento cadastrado. Cadastre o primeiro aqui sem perder as informações do plano.</p>}

        {rows.map((row,index)=>{
          const selected=row.mealSequences.length;
          const quantity=Number(row.dailyQuantity.replace(",","."));
          return <div className="plan-food" key={`${row.foodId}-${index}`}><div className="plan-food-head"><select value={row.foodId} onChange={event=>{const food=foods.find(item=>item.id===event.target.value);patch(index,{foodId:event.target.value,unit:food?.default_unit??row.unit});}}>{foods.map(food=><option key={food.id} value={food.id} disabled={rows.some((item,rowIndex)=>rowIndex!==index&&item.foodId===food.id)}>{food.name}</option>)}</select><button type="button" className="danger-icon" onClick={()=>setRows(current=>current.filter((_,rowIndex)=>rowIndex!==index))} aria-label="Remover alimento">×</button></div><div className="form-grid"><label>Quantidade diária<input inputMode="decimal" value={row.dailyQuantity} onChange={event=>patch(index,{dailyQuantity:event.target.value})} placeholder="Ex.: 60"/></label><label>Unidade<select value={row.unit} onChange={event=>patch(index,{unit:event.target.value as FoodUnit})}>{units.map(unit=><option key={unit} value={unit}>{unitLabels[unit]}</option>)}</select></label></div><div className="meal-selector">{times.map((time,timeIndex)=>{const sequence=timeIndex+1;return <button type="button" key={sequence} className={row.mealSequences.includes(sequence)?"selected":""} onClick={()=>toggle(index,sequence)}><strong>{time}</strong><span>{row.mealSequences.includes(sequence)?"Incluída":"Não incluir"}</span></button>;})}</div>{quantity>0&&selected>0&&<p className="portion-hint">Estimativa: {numberPt(quantity/selected)} {unitLabels[row.unit]} em cada refeição selecionada.</p>}</div>;
        })}

        {error&&<p className="error-box">{error}</p>}{saved&&<p className="success-box">{saved}</p>}
        <button className="primary-button" disabled={busy||!rows.length}>{busy?"Salvando plano…":"Salvar plano"}</button>
      </form>
    </article>
  </section>;
}
