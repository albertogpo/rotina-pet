import {useEffect,useState} from "react";
import {getPushStatus,hasPushConfig,requestPushPermission} from "../lib/push";

type PushState={configured:boolean;supported:boolean;permission:NotificationPermission;subscribed:boolean};

const initialState:PushState={configured:hasPushConfig(),supported:"Notification" in window,permission:"Notification" in window?Notification.permission:"denied",subscribed:false};

export function SettingsPage({email,onSignOut,userId}:{email:string;onSignOut:()=>Promise<void>;userId:string}){
  const[pushState,setPushState]=useState<PushState>(initialState);
  const[pushLoading,setPushLoading]=useState(false);
  const[pushMessage,setPushMessage]=useState("");

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
      <p className="eyebrow">Lembretes</p>
      <h2>Notificações push</h2>
      <p className="muted readable">A partir desta versão, o Rotina Pet está preparado para enviar lembretes em segundo plano por meio de Web Push. Isso cobre iPhone, Android e navegadores desktop compatíveis, desde que o dispositivo esteja inscrito.</p>
      <p><strong>Status:</strong> {statusText}</p>
      {!pushState.subscribed&&pushState.supported&&<button className="primary-button" disabled={pushLoading} onClick={enablePush}>{pushLoading?"Ativando…":"Ativar notificações"}</button>}
      {pushMessage&&<p className={pushState.subscribed?"success-box":"notice"}>{pushMessage}</p>}
    </article>

    <article className="panel-card">
      <p className="eyebrow">Diagnóstico</p>
      <h2>Antes de testar</h2>
      <ul className="settings-checklist">
        <li>Instale o PWA no iPhone para testar push no iOS.</li>
        <li>Permita notificações para o navegador ou para o app instalado.</li>
        <li>No desktop, confira se o macOS ou Windows não está bloqueando alertas.</li>
        <li>Para o envio automático funcionar, ainda é preciso configurar o OneSignal e o cron no Supabase.</li>
      </ul>
    </article>

    <article className="panel-card"><p className="eyebrow">Segurança</p><h2>Dados privados</h2><p className="muted readable">As regras do banco impedem que uma conta veja animais, pesos, alimentos ou planos de outra conta.</p></article>
  </section>;
}
