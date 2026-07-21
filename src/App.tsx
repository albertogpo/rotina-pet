import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {hasSupabaseConfig,supabase} from "./lib/supabase";
import {todayLocal} from "./lib/format";
import * as api from "./services/api";
import type {Food,FoodUnit,MealOccurrence,Pet,PlanFoodInput,Species,WeightEntry} from "./types";
import {SetupScreen} from "./components/SetupScreen";
import {AuthScreen} from "./components/AuthScreen";
import {TodayPage} from "./components/TodayPage";
import {WeightPage} from "./components/WeightPage";
import {FoodsPage} from "./components/FoodsPage";
import {PlanPage} from "./components/PlanPage";
import {PetsPage} from "./components/PetsPage";
import {SettingsPage} from "./components/SettingsPage";
import {PetForm} from "./components/PetForm";
import {AppIcon,type AppIconName} from "./components/AppIcon";

type Tab="today"|"weight"|"foods"|"plan"|"pets"|"settings";

const navItems:{id:Exclude<Tab,"settings">;label:string;icon:AppIconName}[]=[
  {id:"today",label:"Hoje",icon:"today"},
  {id:"weight",label:"Peso",icon:"weight"},
  {id:"foods",label:"Alimentos",icon:"foods"},
  {id:"plan",label:"Plano",icon:"plan"},
  {id:"pets",label:"Animais",icon:"pets"},
];

function App(){
  const[session,setSession]=useState<Session|null>(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[pets,setPets]=useState<Pet[]>([]);
  const[archivedPets,setArchivedPets]=useState<Pet[]>([]);
  const[selectedPetId,setSelectedPetId]=useState("");
  const[todayPetIds,setTodayPetIds]=useState<string[]>([]);
  const[foods,setFoods]=useState<Food[]>([]);
  const[weights,setWeights]=useState<WeightEntry[]>([]);
  const[meals,setMeals]=useState<MealOccurrence[]>([]);
  const[activePlan,setActivePlan]=useState<any>(null);
  const[tab,setTab]=useState<Tab>("today");
  const[loadingBase,setLoadingBase]=useState(false);
  const[loadingPet,setLoadingPet]=useState(false);
  const[loadingToday,setLoadingToday]=useState(false);
  const[error,setError]=useState("");
  const[onboardingBusy,setOnboardingBusy]=useState(false);
  const[autoCreatePet,setAutoCreatePet]=useState(false);
  const notified=useRef(new Set<string>(JSON.parse(localStorage.getItem("rotinaPetNotified")||"[]")));

  const pet=pets.find(x=>x.id===selectedPetId)??pets[0];
  const petById=useMemo(()=>new Map(pets.map(item=>[item.id,item])),[pets]);

  useEffect(()=>{
    if(!supabase){setAuthLoading(false);return;}
    api.getSession().then(setSession).catch(e=>setError(e.message)).finally(()=>setAuthLoading(false));
    const{data}=supabase.auth.onAuthStateChange((_event,nextSession)=>setSession(nextSession));
    return()=>data.subscription.unsubscribe();
  },[]);

  const loadBase=useCallback(async()=>{
    if(!session)return;
    setLoadingBase(true);
    setError("");
    try{
      const[active,archived,foodList]=await Promise.all([api.listPets(),api.listArchivedPets(),api.listFoods()]);
      setPets(active);
      setArchivedPets(archived);
      setFoods(foodList);
      setSelectedPetId(current=>active.some(item=>item.id===current)?current:active[0]?.id??"");
      setTodayPetIds(active.map(item=>item.id));
      if(!active.length&&archived.length)setTab("pets");
    }catch(e){
      setError(e instanceof Error?e.message:"Erro ao carregar os dados.");
    }finally{
      setLoadingBase(false);
    }
  },[session]);

  useEffect(()=>{void loadBase();},[loadBase]);

  const loadSelectedPetData=useCallback(async()=>{
    if(!session||!pet){setWeights([]);setActivePlan(null);return;}
    setLoadingPet(true);
    setError("");
    try{
      const date=todayLocal();
      const[weightList,plan]=await Promise.all([api.listWeights(pet.id),api.getActivePlan(pet.id,date)]);
      setWeights(weightList);
      setActivePlan(plan);
    }catch(e){
      setError(e instanceof Error?e.message:"Erro ao carregar o perfil.");
    }finally{
      setLoadingPet(false);
    }
  },[session,pet?.id]);

  useEffect(()=>{void loadSelectedPetData();},[loadSelectedPetData]);

  const loadTodayData=useCallback(async()=>{
    if(!session||!pets.length){setMeals([]);return;}
    setLoadingToday(true);
    setError("");
    try{
      const date=todayLocal();
      const results=await Promise.all(pets.map(item=>api.ensureTodayMeals(session.user.id,item.id,date)));
      setMeals(results.flat().sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime()));
    }catch(e){
      setError(e instanceof Error?e.message:"Erro ao carregar as refeições de hoje.");
    }finally{
      setLoadingToday(false);
    }
  },[session,pets]);

  useEffect(()=>{void loadTodayData();},[loadTodayData]);

  useEffect(()=>{
    if(!("Notification" in window)||Notification.permission!=="granted")return;
    const check=()=>{
      const now=Date.now();
      for(const meal of meals){
        if(meal.status!=="pending"||notified.current.has(meal.id))continue;
        const due=new Date(meal.scheduled_at).getTime();
        if(now>=due&&now-due<90000){
          const mealPet=petById.get(meal.pet_id);
          const text=meal.meal_templates?.meal_components.map(component=>component.foods?.name).filter(Boolean).join(" + ")||"Refeição programada";
          new Notification(`Refeição de ${mealPet?.name??"seu pet"}`,{body:text,icon:"./icons/icon-192.png"});
          notified.current.add(meal.id);
          localStorage.setItem("rotinaPetNotified",JSON.stringify([...notified.current]));
        }
      }
    };
    check();
    const timer=window.setInterval(check,30000);
    return()=>clearInterval(timer);
  },[meals,petById]);

  if(!hasSupabaseConfig)return <SetupScreen/>;
  if(authLoading)return <main className="center-page"><div className="spinner large"/></main>;
  if(!session)return <AuthScreen/>;

  async function createPet(input:{name:string;species:Species;icon:string}){
    setOnboardingBusy(true);
    try{
      const allWereSelected=todayPetIds.length===pets.length&&pets.every(item=>todayPetIds.includes(item.id));
      const created=await api.createPet(session!.user.id,input);
      setPets(current=>[...current,created]);
      setSelectedPetId(created.id);
      setTodayPetIds(current=>allWereSelected?[...current,created.id]:current.length?current:[created.id]);
      return created;
    }finally{
      setOnboardingBusy(false);
    }
  }

  async function updatePet(id:string,input:{name:string;species:Species;icon:string}){
    const updated=await api.updatePet(id,input);
    setPets(current=>current.map(item=>item.id===id?updated:item));
  }

  async function archivePet(id:string){
    await api.archivePet(id);
    const remaining=pets.filter(item=>item.id!==id);
    if(!remaining.length)setTab("pets");
    await loadBase();
  }

  async function restorePet(id:string){
    await api.restorePet(id);
    await loadBase();
    setSelectedPetId(id);
  }

  async function addWeight(date:string,value:number,notes:string){
    if(!pet)return;
    await api.addWeight(session!.user.id,pet.id,date,value,notes);
    setWeights(await api.listWeights(pet.id));
  }

  async function deleteWeight(id:string){
    if(!pet)return;
    await api.deleteWeight(id);
    setWeights(await api.listWeights(pet.id));
  }

  async function createFood(name:string,unit:FoodUnit){
    const created=await api.createFood(session!.user.id,name,unit);
    setFoods(current=>[...current,created].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")));
    return created;
  }

  async function updateFood(id:string,name:string,unit:FoodUnit){
    const updated=await api.updateFood(id,name,unit);
    setFoods(current=>current.map(item=>item.id===id?updated:item).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")));
  }

  async function archiveFood(id:string){
    await api.archiveFood(id);
    setFoods(current=>current.filter(item=>item.id!==id));
  }

  async function savePlan(input:{name:string;startsOn:string;mealTimes:string[];foods:PlanFoodInput[]}){
    if(!pet)return;
    await api.savePlan({petId:pet.id,...input});
    await Promise.all([loadSelectedPetData(),loadTodayData()]);
    setTab("today");
  }

  async function toggleMeal(meal:MealOccurrence){
    await api.setMealStatus(meal.id,meal.status==="completed"?"pending":"completed");
    await loadTodayData();
  }

  async function skipMeal(meal:MealOccurrence){
    await api.setMealStatus(meal.id,meal.status==="skipped"?"pending":"skipped");
    await loadTodayData();
  }

  function toggleTodayPetFilter(id:string){
    const allIds=pets.map(item=>item.id);
    const allSelected=todayPetIds.length===allIds.length&&allIds.every(itemId=>todayPetIds.includes(itemId));
    if(allSelected){
      setTodayPetIds([id]);
      setSelectedPetId(id);
      return;
    }
    if(todayPetIds.includes(id)){
      const next=todayPetIds.filter(itemId=>itemId!==id);
      setTodayPetIds(next.length?next:allIds);
      return;
    }
    setTodayPetIds([...todayPetIds,id]);
  }

  function openPetCreation(){
    setAutoCreatePet(true);
    setTab("pets");
  }

  function openPlanForPet(petId?:string){
    if(petId)setSelectedPetId(petId);
    setTab("plan");
  }

  if(!pets.length&&!archivedPets.length&&!loadingBase){
    return <main className="center-page"><section className="auth-card"><div className="brand-mark">🐾</div><p className="eyebrow">Primeiro passo</p><h1>Cadastre seu primeiro animal</h1><p className="muted">Depois você poderá adicionar os demais perfis.</p><PetForm onSave={createPet} busy={onboardingBusy}/>{error&&<p className="error-box">{error}</p>}</section></main>;
  }

  const accountInitial=(session.user.email?.trim().charAt(0)||"U").toUpperCase();
  const isToday=tab==="today";

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-heading"><span className="brand-symbol" aria-hidden="true">●</span><div><p className="eyebrow">Rotina e acompanhamento</p><h1>Rotina Pet</h1></div></div>
      <button className="avatar-button" onClick={()=>setTab("settings")} title="Conta e configurações" aria-label="Abrir conta e configurações">{accountInitial}</button>
    </header>

    <section className="pet-switcher" aria-label={isToday?"Filtrar refeições por animal":"Selecionar animal"}>
      {pets.map(item=>{
        const active=isToday?todayPetIds.includes(item.id):pet?.id===item.id;
        return <button key={item.id} className={`pet-chip ${active?"active":""}`} aria-pressed={active} onClick={()=>isToday?toggleTodayPetFilter(item.id):setSelectedPetId(item.id)}><span className="pet-chip-icon">{item.icon}</span><span>{item.name}</span></button>;
      })}
      <button className="pet-chip add-pet" onClick={openPetCreation} aria-label="Adicionar novo animal" title="Adicionar novo animal">＋</button>
    </section>

    {isToday&&pets.length>1&&<p className="filter-hint">Todos começam selecionados. Toque em um animal para ver apenas ele; depois, adicione outros ao filtro.</p>}
    {error&&<p className="error-box global-error">{error}</p>}

    <nav className="main-nav" aria-label="Navegação principal">
      {navItems.map(item=><button key={item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}><AppIcon name={item.icon}/><span>{item.label}</span></button>)}
    </nav>

    <div className="page-content">
      {tab==="today"&&<TodayPage pets={pets} meals={meals} selectedPetIds={todayPetIds} loading={loadingToday||loadingBase} onToggle={toggleMeal} onSkip={skipMeal} onOpenPlan={openPlanForPet} onOpenPets={()=>setTab("pets")}/>} 
      {tab==="weight"&&(pet?<WeightPage pet={pet} entries={weights} loading={loadingPet} onAdd={addWeight} onDelete={deleteWeight}/>:<section className="empty-card"><h2>Nenhum animal ativo</h2><p>Restaure um perfil arquivado ou cadastre um novo animal.</p><button className="primary-button" onClick={()=>setTab("pets")}>Abrir animais</button></section>)}
      {tab==="foods"&&<FoodsPage foods={foods} onCreate={createFood} onUpdate={updateFood} onArchive={archiveFood}/>} 
      {tab==="plan"&&(pet?<PlanPage pet={pet} foods={foods} activePlan={activePlan} onSave={savePlan} onCreateFood={createFood}/>:<section className="empty-card"><h2>Nenhum animal ativo</h2><p>Cadastre ou restaure um animal antes de criar um plano.</p><button className="primary-button" onClick={()=>setTab("pets")}>Abrir animais</button></section>)}
      {tab==="pets"&&<PetsPage pets={pets} archivedPets={archivedPets} onCreate={createPet} onUpdate={updatePet} onArchive={archivePet} onRestore={restorePet} autoStartCreate={autoCreatePet} onAutoStartHandled={()=>setAutoCreatePet(false)}/>} 
      {tab==="settings"&&<SettingsPage email={session.user.email??"Conta"} onSignOut={api.signOut}/>} 
    </div>

    <footer><span>Rotina Pet</span><span>•</span><span>versão de testes</span></footer>
  </main>;
}

export default App;
