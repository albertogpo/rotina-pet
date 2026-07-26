import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from "react";
import {getPushStatus,hasPushConfig,setPushSubscription} from "../lib/push";

type PushState={configured:boolean;supported:boolean;permission:NotificationPermission;subscribed:boolean};

const initialState:PushState={configured:hasPushConfig(),supported:"Notification" in window,permission:"Notification" in window?Notification.permission:"denied",subscribed:false};

function availableTimeZones(current:string,detected:string){
  const supported=(Intl as unknown as {supportedValuesOf?:(key:"timeZone")=>string[]}).supportedValuesOf?.("timeZone")??[];
  return [...new Set([current,detected,"America/Sao_Paulo","America/Manaus","America/Rio_Branco","America/Noronha","UTC",...supported].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}

function matchesTimezone(timezone:string,query:string){
  const normalized=query.trim().toLocaleLowerCase("pt-BR");
  if(!normalized)return true;
  return timezone.toLocaleLowerCase("pt-BR").replace(/[\/_-]+/g," ").includes(normalized.replace(/[\/_-]+/g," "));
}

function validTimezone(timezone:string){
  try{new Intl.DateTimeFormat("pt-BR",{timeZone:timezone}).format();return true;}catch{return false;}
}

export function SettingsPage({
  email,
  onSignOut,
  userId,
  timezone,
  detectedTimezone,
  onTimezoneChange,
}:{
  email:string;
  onSignOut:()=>Promise<void>;
  userId:string;
  timezone:string;
  detectedTimezone:string;
  onTimezoneChange:(timezone:string)=>Promise<void>;
}){
  const[pushState,setPushState]=useState<PushState>(initialState);
  const[pushLoading,setPushLoading]=useState(false);
  const[pushMessage,setPushMessage]=useState("");
  const[timezoneDraft,setTimezoneDraft]=useState(timezone);
  const[timezoneQuery,setTimezoneQuery]=useState(timezone);
  const[timezoneOpen,setTimezoneOpen]=useState(false);
  const[activeTimezoneIndex,setActiveTimezoneIndex]=useState(0);
  const[timezoneLoading,setTimezoneLoading]=useState(false);
  const[timezoneMessage,setTimezoneMessage]=useState("");
  const timezoneListRef=useRef<HTMLDivElement|null>(null);
  const timezones=useMemo(()=>availableTimeZones(timezone,detectedTimezone),[timezone,detectedTimezone]);
  const filteredTimezones=useMemo(()=>timezones.filter(item=>matchesTimezone(item,timezoneQuery)),[timezones,timezoneQuery]);

  useEffect(()=>{setTimezoneDraft(timezone);setTimezoneQuery(timezone);},[timezone]);
  useEffect(()=>{setActiveTimezoneIndex(0);},[timezoneQuery]);
  useEffect(()=>{
    timezoneListRef.current?.querySelector<HTMLElement>(`[data-timezone-index="${activeTimezoneIndex}"]`)?.scrollIntoView({block:"nearest"});
  },[activeTimezoneIndex]);

  async function refreshPushStatus(){
    try{setPushState(await getPushStatus(userId));}catch{}
  }

  useEffect(()=>{
    let cancelled=false;
    void getPushStatus(userId).then(state=>{if(!cancelled)setPushState(state);}).catch(()=>{});
    const handleVisible=()=>{if(document.visibilityState==="visible")void refreshPushStatus();};
    document.addEventListener("visibilitychange",handleVisible);
    return()=>{cancelled=true;document.removeEventListener("visibilitychange",handleVisible);};
  },[userId]);

  async function changePush(enabled:boolean){
    if(pushLoading)return;
    setPushLoading(true);
    setPushMessage("");
    try{
      const next=await setPushSubscription(enabled,userId);
      if("configured" in next&&next.configured===false){
        setPushMessage("Falta configurar o OneSignal no ambiente publicado para gerenciar as notificações.");
        return;
      }
      const state=next as PushState;
      setPushState(state);
      if(enabled){
        setPushMessage(state.subscribed?"Notificações ativadas neste aparelho.":state.permission==="denied"?"As notificações estão bloqueadas nas configurações do navegador ou do sistema.":"A autorização não foi concluída.");
      }else{
        setPushMessage("Notificações desativadas neste aparelho. A permissão do sistema foi preservada para você poder reativá-las depois.");
      }
    }catch(error){
      setPushMessage(error instanceof Error?error.message:"Não foi possível alterar as notificações agora.");
      await refreshPushStatus();
    }finally{
      setPushLoading(false);
    }
  }

  function selectTimezone(value:string){
    setTimezoneDraft(value);
    setTimezoneQuery(value);
    setTimezoneOpen(false);
    setTimezoneMessage("");
  }

  function handleTimezoneKeyDown(event:KeyboardEvent<HTMLInputElement>){
    if(event.key==="ArrowDown"){
      event.preventDefault();
      setTimezoneOpen(true);
      setActiveTimezoneIndex(current=>Math.min(current+1,Math.max(0,filteredTimezones.length-1)));
    }else if(event.key==="ArrowUp"){
      event.preventDefault();
      setTimezoneOpen(true);
      setActiveTimezoneIndex(current=>Math.max(0,current-1));
    }else if(event.key==="Enter"&&timezoneOpen&&filteredTimezones.length){
      event.preventDefault();
      selectTimezone(filteredTimezones[activeTimezoneIndex]??filteredTimezones[0]);
    }else if(event.key==="Escape"){
      setTimezoneOpen(false);
      setTimezoneQuery(timezoneDraft);
    }
  }

  async function saveTimezone(){
    const value=timezoneDraft.trim();
    if(!value||!validTimezone(value)){setTimezoneMessage("Selecione um fuso válido na lista.");return;}
    setTimezoneLoading(true);
    setTimezoneMessage("");
    try{
      await onTimezoneChange(value);
      setTimezoneMessage("Fuso da rotina atualizado. Os horários continuam vinculados a este fuso em todos os dispositivos.");
    }catch(error){
      setTimezoneMessage(error instanceof Error?error.message:"Não foi possível atualizar o fuso da rotina.");
    }finally{
      setTimezoneLoading(false);
    }
  }

  const statusText=!pushState.supported
    ?"Não suportadas neste navegador"
    :!pushState.configured
      ?"Integração pronta, aguardando configuração do OneSignal"
      :pushState.subscribed
        ?"Ativadas neste aparelho"
        :pushState.permission==="denied"
          ?"Bloqueadas pelo navegador ou sistema"
          :pushState.permission==="granted"
            ?"Desativadas neste aparelho"
            :"Ainda não autorizadas";
  const pushUnavailable=!pushState.supported||!pushState.configured||pushState.permission==="denied";

  return <section className="page-grid">
    <article className="panel-card"><p className="eyebrow">Conta</p><h2>{email}</h2><button className="secondary-button" onClick={onSignOut}>Sair</button></article>

    <article className="panel-card">
      <p className="eyebrow">Rotina</p>
      <h2>Fuso horário</h2>
      <p className="muted readable">Os horários do plano seguem o fuso configurado na conta. Viajar com o celular não altera silenciosamente a rotina dos animais.</p>
      <label className="field-label" htmlFor="routine-timezone">Fuso da rotina</label>
      <div className={`timezone-combobox ${timezoneOpen?"is-open":""}`} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)){setTimezoneOpen(false);setTimezoneQuery(timezoneDraft);}}}>
        <input
          id="routine-timezone"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={timezoneOpen}
          aria-controls="routine-timezone-options"
          aria-activedescendant={timezoneOpen&&filteredTimezones.length?`timezone-option-${activeTimezoneIndex}`:undefined}
          value={timezoneQuery}
          onFocus={()=>setTimezoneOpen(true)}
          onClick={()=>setTimezoneOpen(true)}
          onChange={event=>{setTimezoneQuery(event.target.value);setTimezoneDraft(event.target.value);setTimezoneOpen(true);setTimezoneMessage("");}}
          onKeyDown={handleTimezoneKeyDown}
          placeholder="Busque por cidade ou região"
          autoComplete="off"
        />
        <button className="timezone-combobox-toggle" type="button" tabIndex={-1} aria-label={timezoneOpen?"Fechar lista de fusos":"Abrir lista de fusos"} onMouseDown={event=>event.preventDefault()} onClick={()=>setTimezoneOpen(current=>!current)}>⌄</button>
        {timezoneOpen&&<div className="timezone-options" id="routine-timezone-options" role="listbox" ref={timezoneListRef}>
          {filteredTimezones.length?filteredTimezones.map((item,index)=><button
            type="button"
            role="option"
            id={`timezone-option-${index}`}
            data-timezone-index={index}
            aria-selected={item===timezoneDraft}
            className={`${index===activeTimezoneIndex?"is-active":""} ${item===timezoneDraft?"is-selected":""}`}
            key={item}
            onMouseDown={event=>event.preventDefault()}
            onMouseEnter={()=>setActiveTimezoneIndex(index)}
            onClick={()=>selectTimezone(item)}
          ><span>{item}</span><small>{item===timezone?"Fuso atual":item===detectedTimezone?"Neste aparelho":""}</small></button>):<p className="timezone-empty">Nenhum fuso encontrado.</p>}
        </div>}
      </div>
      <p className="muted timezone-detected">Fuso detectado neste aparelho: <strong>{detectedTimezone}</strong></p>
      <div className="timezone-actions">
        {detectedTimezone!==timezoneDraft&&<button className="secondary-button" type="button" onClick={()=>selectTimezone(detectedTimezone)}>Usar o fuso deste aparelho</button>}
        <button className="primary-button" type="button" disabled={timezoneLoading||timezoneDraft.trim()===timezone||!validTimezone(timezoneDraft.trim())} onClick={()=>void saveTimezone()}>{timezoneLoading?"Salvando…":"Salvar fuso"}</button>
      </div>
      {timezoneMessage&&<p className={timezoneMessage.startsWith("Fuso da rotina atualizado")?"success-box":"notice"}>{timezoneMessage}</p>}
    </article>

    <article className="panel-card">
      <p className="eyebrow">Lembretes</p>
      <h2>Notificações</h2>
      <p className="muted readable">O controle vale para este aparelho e navegador. No iPhone, o Rotina Pet precisa estar instalado na Tela de Início e autorizado a enviar notificações.</p>
      <div className={`notification-setting ${pushUnavailable?"is-unavailable":""}`}>
        <div><strong>Notificações neste aparelho</strong><span>{statusText}</span></div>
        <button
          className={`toggle-switch ${pushState.subscribed?"is-on":""}`}
          type="button"
          role="switch"
          aria-checked={pushState.subscribed}
          aria-label={`${pushState.subscribed?"Desativar":"Ativar"} notificações neste aparelho`}
          disabled={pushLoading||pushUnavailable}
          onClick={()=>void changePush(!pushState.subscribed)}
        ><span/></button>
      </div>
      {pushState.permission==="denied"&&pushState.supported&&<p className="notice">As notificações foram bloqueadas fora do aplicativo. Reative a permissão nas configurações do navegador ou do sistema e volte a esta tela.</p>}
      {pushMessage&&<p className={pushState.subscribed||pushMessage.startsWith("Notificações desativadas")?"success-box":"notice"}>{pushMessage}</p>}
    </article>

    <article className="panel-card">
      <p className="eyebrow">Diagnóstico</p>
      <h2>Como os lembretes funcionam</h2>
      <ul className="settings-checklist">
        <li>Refeições no mesmo horário são reunidas em uma única notificação.</li>
        <li>O lembrete mostra os animais e um resumo dos itens que couberem.</li>
        <li>Ao tocar, o aplicativo abre a tela Hoje no horário correspondente.</li>
        <li>O histórico no aplicativo continua sendo a fonte principal, mesmo que o sistema silencie um push.</li>
      </ul>
    </article>

    <article className="panel-card"><p className="eyebrow">Segurança</p><h2>Dados privados</h2><p className="muted readable">As regras do banco impedem que uma conta veja animais, pesos, alimentos ou planos de outra conta.</p></article>
  </section>;
}
