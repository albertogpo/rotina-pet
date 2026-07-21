import {useEffect,useMemo,useState} from "react";
import {generateEvenTimes,numberPt,todayLocal,unitLabels} from "../lib/format";
import type {Food,FoodUnit,Pet,PlanFoodInput} from "../types";

const units=Object.keys(unitLabels) as FoodUnit[];

export function PlanPage({pet,foods,activePlan,onSave,onCreateFood}:{pet:Pet;foods:Food[];activePlan:any;onSave:(input:{name:string;startsOn:string;mealTimes:string[];foods:PlanFoodInput[]})=>Promise<void>;onCreateFood:(name:string,unit:FoodUnit)=>Promise<Food>}){
  const[name,setName]=useState("Plano alimentar");
  const[startsOn,setStartsOn]=useState(todayLocal());
  const[count,setCount]=useState(4);
  const[mode,setMode]=useState<"window"|"manual">("window");
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

  useEffect(()=>{
    setManualTimes(current=>Array.from({length:count},(_,index)=>current[index]??"12:00"));
    setRows(current=>current.map(row=>{
      const valid=row.mealSequences.filter(sequence=>sequence<=count);
      return{...row,mealSequences:valid.length?valid:Array.from({length:count},(_,index)=>index+1)};
    }));
  },[count]);

  const suggested=useMemo(()=>{try{return generateEvenTimes(windowStart,windowEnd,count);}catch{return[];}},[windowStart,windowEnd,count]);
  const times=mode==="window"?suggested:manualTimes;

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

  async function submit(event:React.FormEvent){
    event.preventDefault();
    setError("");
    setSaved("");
    if(!times.length||times.some(time=>!time)){setError("Revise os horários.");return;}
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
    {activePlan&&<article className="current-plan"><div><p className="eyebrow">Plano atual de {pet.name}</p><h2>{activePlan.name}</h2><p>Válido desde {new Date(`${activePlan.starts_on}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><span>{activePlan.meal_templates?.length??0} refeições/dia</span></article>}

    <article className="panel-card">
      <p className="eyebrow">Configuração</p><h2>{activePlan?"Substituir plano":"Criar plano alimentar"}</h2><p className="muted readable">Ao salvar um novo plano, o anterior é encerrado sem apagar o histórico.</p>
      <form className="stack-form" onSubmit={submit}>
        <div className="form-grid"><label>Nome do plano<input value={name} onChange={event=>setName(event.target.value)}/></label><label>Início<input type="date" required value={startsOn} onChange={event=>setStartsOn(event.target.value)}/></label></div>
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
