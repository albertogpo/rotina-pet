import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {hasSupabaseConfig,supabase} from "./lib/supabase";
import {detectTimeZone,shiftLocalDate,todayInTimeZone} from "./lib/format";
import {initPush,logoutPush} from "./lib/push";
import * as api from "./services/api";
import type {Food,FoodUnit,MealOccurrence,MealOutcome,Pet,PlanFoodInput,Species,WeightEntry} from "./types";
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
type MealDeepLink={date:string;time:string};

const navItems:{id:Exclude<Tab,"settings">;label:string;icon:AppIconName}[]=[
  {id:"today",label:"Hoje",icon:"today"},
  {id:"weight",label:"Peso",icon:"weight"},
  {id:"foods",label:"Alimentos",icon:"foods"},
  {id:"plan",label:"Plano",icon:"plan"},
  {id:"pets",label:"Animais",icon:"pets"},
];

function readMealDeepLink():MealDeepLink|null{
  const params=new URLSearchParams(window.location.search);
  const date=params.get("date")??"";
  const time=params.get("time")??"";
  if(params.get("view")!=="today"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
  return{date,time};
}

function clearMealDeepLinkFromUrl(){
  const url=new URL(window.location.href);
  url.searchParams.delete("view");
  url.searchParams.delete("date");
  url.searchParams.delete("time");
  window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`);
}

function App(){
  const detectedTimezone=useMemo(()=>detectTimeZone(),[]);
  const initialDeepLink=useRef<MealDeepLink|null>(readMealDeepLink());
  const[session,setSession]=useState<Session|null>(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[preferencesReady,setPreferencesReady]=useState(false);
  const[timezone,setTimezone]=useState(detectedTimezone);
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
  const[deepLinkTarget,setDeepLinkTarget]=useState<MealDeepLink|null>(initialDeepLink.current);
  const[displayDate,setDisplayDate]=useState(initialDeepLink.current?.date??todayInTimeZone(detectedTimezone));
  const retryTimer=useRef<number|undefined>(undefined);
  const lastAutoRetryAt=useRef(0);

  const pet=pets.find(x=>x.id===selectedPetId)??pets[0];
  const today=todayInTimeZone(timezone);

  useEffect(()=>{
    if(!supabase){setAuthLoading(false);return;}
    api.getSession().then(setSession).catch(e=>setError(e.message)).finally(()=>setAuthLoading(false));
    const{data}=supabase.auth.onAuthStateChange((_event,nextSession)=>setSession(nextSession));
    return()=>data.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session){setPreferencesReady(false);return;}
    let cancelled=false;
    setPreferencesReady(false);
    void api.ensureUserPreferences(detectedTimezone)
      .then(preferences=>{
        if(cancelled)return;
        setTimezone(preferences.timezone);
        if(!initialDeepLink.current)setDisplayDate(todayInTimeZone(preferences.timezone));
      })
      .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Não foi possível carregar o fuso da rotina.");})
      .finally(()=>{if(!cancelled)setPreferencesReady(true);});
    void initPush(session.user.id).catch(()=>{});
    return()=>{cancelled=true;};
  },[session,detectedTimezone]);

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
      setTodayPetIds(current=>{
        const next=current.filter(id=>active.some(item=>item.id===id));
        return next.length?next:active.map(item=>item.id);
      });
      if(!active.length&&archived.length)setTab("pets");
    }catch(e){
      setError(e instanceof Error?e.message:"Erro ao carregar os dados.");
    }finally{
      setLoadingBase(false);
    }
  },[session]);

  useEffect(()=>{void loadBase();},[loadBase]);

  useEffect(()=>{
    if(!deepLinkTarget||!pets.length)return;
    setTab("today");
    setDisplayDate(deepLinkTarget.date);
    setTodayPetIds(pets.map(item=>item.id));
  },[deepLinkTarget,pets]);

  const loadSelectedPetData=useCallback(async()=>{
    if(!session||!pet){setWeights([]);setActivePlan(null);return;}
    setLoadingPet(true);
    setError("");
    try{
      const[weightList,plan]=await Promise.all([api.listWeights(pet.id),api.getActivePlan(pet.id,today)]);
      setWeights(weightList);
      setActivePlan(plan);
    }catch(e){
      setError(e instanceof Error?e.message:"Erro ao carregar o perfil.");
    }finally{
      setLoadingPet(false);
    }
  },[session,pet?.id,today]);

  useEffect(()=>{void loadSelectedPetData();},[loadSelectedPetData]);

  const loadDisplayedMeals=useCallback(async()=>{
    if(!session||!pets.length||!preferencesReady){setMeals([]);return;}
    setLoadingToday(true);
    setError("");
    try{
      const result=await api.ensureMealsForDate(displayDate);
      setMeals(result.sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime()));
    }catch(e){
      setError(e instanceof Error?e.message:`Erro ao carregar as refeições de ${displayDate}.`);
    }finally{
      setLoadingToday(false);
    }
  },[session,pets,displayDate,preferencesReady,timezone]);

  useEffect(()=>{void loadDisplayedMeals();},[loadDisplayedMeals]);

  const retryAllData=useCallback(async()=>{
    clearTimeout(retryTimer.current);
    await Promise.all([loadBase(),loadSelectedPetData(),loadDisplayedMeals()]);
  },[loadBase,loadSelectedPetData,loadDisplayedMeals]);

  useEffect(()=>{
    if(!error||loadingBase||loadingPet||loadingToday)return;
    const now=Date.now();
    if(now-lastAutoRetryAt.current<15000)return;
    lastAutoRetryAt.current=now;
    clearTimeout(retryTimer.current);
    retryTimer.current=window.setTimeout(()=>{void retryAllData();},1800);
    return()=>clearTimeout(retryTimer.current);
  },[error,loadingBase,loadingPet,loadingToday,retryAllData]);

  useEffect(()=>{
    const handleVisible=()=>{
      if(document.visibilityState==="visible"&&error){void retryAllData();}
    };
    document.addEventListener("visibilitychange",handleVisible);
    return()=>document.removeEventListener("visibilitychange",handleVisible);
  },[error,retryAllData]);

  useEffect(()=>{
    const handleNavigation=()=>{
      const next=readMealDeepLink();
      if(next)setDeepLinkTarget(next);
    };
    window.addEventListener("popstate",handleNavigation);
    return()=>window.removeEventListener("popstate",handleNavigation);
  },[]);

  useEffect(()=>{
    if(displayDate>today)setDisplayDate(today);
  },[displayDate,today]);

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
    await Promise.all([loadSelectedPetData(),loadDisplayedMeals()]);
    setDisplayDate(todayInTimeZone(timezone));
    setTab("today");
  }

  async function updatePlanSchedule(planId:string,startsOn:string,mealTimes:string[]){
    await api.updatePlanSchedule(planId,startsOn,mealTimes);
    await Promise.all([loadSelectedPetData(),loadDisplayedMeals()]);
    setDisplayDate(todayInTimeZone(timezone));
    setTab("today");
  }

  async function setMealOutcome(meal:MealOccurrence,outcome:MealOutcome){
    setError("");
    try{
      if(outcome==="pending")await api.setMealOutcome(meal.id,"pending",null);
      else if(outcome==="not_served")await api.setMealOutcome(meal.id,"skipped",null);
      else await api.setMealOutcome(meal.id,"completed",outcome);
      await loadDisplayedMeals();
    }catch(e){
      setError(e instanceof Error?e.message:"Não foi possível registrar a refeição.");
      throw e;
    }
  }

  async function updateTimezone(nextTimezone:string){
    const preferences=await api.updateUserTimezone(nextTimezone);
    setTimezone(preferences.timezone);
    setDisplayDate(todayInTimeZone(preferences.timezone));
  }

  async function handleSignOut(){
    try{await logoutPush();}catch{}
    await api.signOut();
  }

  const handleDeepLinkFocus=useCallback(()=>{
    clearMealDeepLinkFromUrl();
    initialDeepLink.current=null;
    setDeepLinkTarget(null);
  },[]);

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

  function showPreviousDay(){
    setDisplayDate(current=>shiftLocalDate(current,-1));
  }

  function showNextDay(){
    setDisplayDate(current=>current<today?shiftLocalDate(current,1):current);
  }

  function returnToToday(){
    setDisplayDate(today);
  }

  if(!hasSupabaseConfig)return <SetupScreen/>;
  if(authLoading)return <main className="center-page"><div className="spinner large"/></main>;
  if(!session)return <AuthScreen/>;

  const authenticatedSession:Session=session;
  const authenticatedUser=authenticatedSession.user;

  if(!pets.length&&!archivedPets.length&&!loadingBase){
    return <main className="center-page"><section className="auth-card"><div className="brand-mark">🐾</div><p className="eyebrow">Primeiro passo</p><h1>Cadastre seu primeiro animal</h1><p className="muted">Depois você poderá adicionar os demais perfis.</p><PetForm onSave={createPet} busy={onboardingBusy}/>{error&&<div className="error-box error-with-action"><span>{error}</span><button className="secondary-button compact" onClick={()=>void retryAllData()}>Tentar novamente</button></div>}</section></main>;
  }

  const accountInitial=(authenticatedUser.email?.trim().charAt(0)||"U").toUpperCase();
  const isTodayTab=tab==="today";
  const showGlobalRetry=Boolean(error&&!loadingBase&&!loadingPet&&!loadingToday);

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-heading"><span className="brand-symbol" aria-hidden="true">●</span><div><p className="eyebrow">Rotina e acompanhamento</p><h1>Rotina Pet</h1></div></div>
      <button className="avatar-button" onClick={()=>setTab("settings")} title="Conta e configurações" aria-label="Abrir conta e configurações">{accountInitial}</button>
    </header>

    {tab!=="settings"&&<section className="pet-switcher" aria-label={isTodayTab?"Filtrar refeições por animal":"Selecionar animal"}>
      {pets.map(item=>{
        const active=isTodayTab?todayPetIds.includes(item.id):pet?.id===item.id;
        return <button key={item.id} className={`pet-chip ${active?"active":""}`} aria-pressed={active} onClick={()=>isTodayTab?toggleTodayPetFilter(item.id):setSelectedPetId(item.id)}><span className="pet-chip-icon">{item.icon}</span><span>{item.name}</span></button>;
      })}
      <button className="pet-chip add-pet" onClick={openPetCreation} aria-label="Adicionar novo animal" title="Adicionar novo animal">＋</button>
    </section>}

    {isTodayTab&&pets.length>1&&<p className="filter-hint">Todos começam selecionados. Toque em um animal para ver apenas ele; depois, adicione outros ao filtro.</p>}
    {showGlobalRetry&&<div className="error-box global-error error-with-action"><span>{error}</span><button className="secondary-button compact" onClick={()=>void retryAllData()}>Tentar novamente</button></div>}

    <nav className="main-nav" aria-label="Navegação principal">
      {navItems.map(item=><button key={item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}><AppIcon name={item.icon}/><span>{item.label}</span></button>)}
    </nav>

    <div className="page-content">
      {tab==="today"&&<TodayPage
        pets={pets}
        meals={meals}
        selectedPetIds={todayPetIds}
        loading={loadingToday||loadingBase||!preferencesReady}
        onSetOutcome={setMealOutcome}
        onOpenPlan={openPlanForPet}
        onOpenPets={()=>setTab("pets")}
        displayDate={displayDate}
        isToday={displayDate===today}
        canGoForward={displayDate<today}
        onPreviousDay={showPreviousDay}
        onNextDay={showNextDay}
        onGoToToday={returnToToday}
        timezone={timezone}
        focusTime={deepLinkTarget?.date===displayDate?deepLinkTarget.time:null}
        onFocusHandled={handleDeepLinkFocus}
      />}
      {tab==="weight"&&(pet?<WeightPage pet={pet} entries={weights} loading={loadingPet} onAdd={addWeight} onDelete={deleteWeight} today={today}/>:<section className="empty-card"><h2>Nenhum animal ativo</h2><p>Restaure um perfil arquivado ou cadastre um novo animal.</p><button className="primary-button" onClick={()=>setTab("pets")}>Abrir animais</button></section>)}
      {tab==="foods"&&<FoodsPage foods={foods} onCreate={createFood} onUpdate={updateFood} onArchive={archiveFood}/>} 
      {tab==="plan"&&(pet?<PlanPage pet={pet} foods={foods} activePlan={activePlan} onSave={savePlan} onUpdateSchedule={updatePlanSchedule} onCreateFood={createFood} today={today}/>:<section className="empty-card"><h2>Nenhum animal ativo</h2><p>Cadastre ou restaure um animal antes de criar um plano.</p><button className="primary-button" onClick={()=>setTab("pets")}>Abrir animais</button></section>)}
      {tab==="pets"&&<PetsPage pets={pets} archivedPets={archivedPets} onCreate={createPet} onUpdate={updatePet} onArchive={archivePet} onRestore={restorePet} autoStartCreate={autoCreatePet} onAutoStartHandled={()=>setAutoCreatePet(false)}/>} 
      {tab==="settings"&&<SettingsPage email={authenticatedUser.email??"Conta"} onSignOut={handleSignOut} userId={authenticatedUser.id} timezone={timezone} detectedTimezone={detectedTimezone} onTimezoneChange={updateTimezone}/>} 
    </div>

    <footer><span>Rotina Pet</span><span>•</span><span>v0.6.2</span></footer>
  </main>;
}

export default App;
