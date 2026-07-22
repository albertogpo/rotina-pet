import {useEffect,useMemo,useState} from "react";
import {getPushStatus,hasPushConfig,requestPushPermission} from "../lib/push";

type PushState={configured:boolean;supported:boolean;permission:NotificationPermission;subscribed:boolean};

const initialState:PushState={configured:hasPushConfig(),supported:"Notification" in window,permission:"Notification" in window?Notification.permission:"denied",subscribed:false};

function availableTimeZones(current:string,detected:string){
  const supported=(Intl as unknown as {supportedValuesOf?:(key:"timeZone")=>string[]}).supportedValuesOf?.("timeZone")??[];
  return [...new Set([current,detected,"America/Sao_Paulo","America/Manaus","America/Rio_Branco","America/Noronha","UTC",...supported].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
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
  const[timezoneLoading,setTimezoneLoading]=useState(false);
  const[timezoneMessage,setTimezoneMessage]=useState("");
  const timezones=useMemo(()=>availableTimeZones(timezone,detectedTimezone),[timezone,detectedTimezone]);

  useEffect(()=>{setTimezoneDraft(timezone);},[timezone]);

  useEffect(()=>{
    let cancelled=false;
    void getPushStatus(userId).then(state=>{if(!cancelled)setPushState(state);}).catch(()=>{});
    return()=>{cancelled=true;};
  },[userId]);

  async function enablePush(){
    setPushLoading(true);
    setPushMessage("");
    try{
      const next=await requestPushPermission(userId);
      if("configured" in next&&next.configured===false){
        setPushMessage("Falta configurar o OneSignal no ambiente publicado para ativar as notificações push.");
      }else{
        setPushState(next as PushState);
        setPushMessage((next as PushState).subscribed?"Este aparelho está inscrito para receber notificações push.":"A permissão foi solicitada, mas a inscrição ainda não foi concluída.");
      }
    }catch(error){
      setPushMessage(error instanceof Error?error.message:"Não foi possível ativar as notificações agora.");
    }finally{
      setPushLoading(false);
    }
  }

  async function saveTimezone(){
    const value=timezoneDraft.trim();
    if(!value)return;
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
            ?"Permissão concedida, falta concluir a inscrição"
            :"Ainda não autorizadas";

  return <section className="page-grid">
    <article className="panel-card"><p className="eyebrow">Conta</p><h2>{email}</h2><button className="secondary-button" onClick={onSignOut}>Sair</button></article>

    <article className="panel-card">
      <p className="eyebrow">Rotina</p>
      <h2>Fuso horário</h2>
      <p className="muted readable">Os horários do plano seguem o fuso configurado na conta. Viajar com o celular não altera silenciosamente a rotina dos animais.</p>
      <label className="field-label" htmlFor="routine-timezone">Fuso da rotina</label>
      <input id="routine-timezone" list="routine-timezones" value={timezoneDraft} onChange={event=>setTimezoneDraft(event.target.value)} placeholder="America/Sao_Paulo" autoComplete="off"/>
      <datalist id="routine-timezones">{timezones.map(item=><option value={item} key={item}/>)}</datalist>
      <p className="muted timezone-detected">Fuso detectado neste aparelho: <strong>{detectedTimezone}</strong></p>
      <div className="timezone-actions">
        {detectedTimezone!==timezoneDraft&&<button className="secondary-button" type="button" onClick={()=>setTimezoneDraft(detectedTimezone)}>Usar o fuso deste aparelho</button>}
        <button className="primary-button" type="button" disabled={timezoneLoading||timezoneDraft.trim()===timezone} onClick={()=>void saveTimezone()}>{timezoneLoading?"Salvando…":"Salvar fuso"}</button>
      </div>
      {timezoneMessage&&<p className={timezoneMessage.startsWith("Fuso da rotina atualizado")?"success-box":"notice"}>{timezoneMessage}</p>}
    </article>

    <article className="panel-card">
      <p className="eyebrow">Lembretes</p>
      <h2>Notificações push</h2>
      <p className="muted readable">O Rotina Pet envia lembretes em segundo plano por Web Push. No iPhone, o aplicativo precisa estar instalado na Tela de Início e autorizado a enviar notificações.</p>
      <p><strong>Status:</strong> {statusText}</p>
      {!pushState.subscribed&&pushState.supported&&<button className="primary-button" disabled={pushLoading} onClick={enablePush}>{pushLoading?"Ativando…":"Ativar notificações"}</button>}
      {pushMessage&&<p className={pushState.subscribed?"success-box":"notice"}>{pushMessage}</p>}
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
