import {useEffect,useMemo,useState} from "react";
import type {Pet,Species} from "../types";
import type {AcceptProfessionalInvitationResult,InvitationPetResolution,ProfessionalInvitationPreview} from "../types/professional";
import {appErrorText} from "../lib/errors";
import {buildProfessionalInvitationUrl} from "../lib/professionalInvite";
import {acceptProfessionalInvitation,getProfessionalInvitationPreview,resolveInvitationPets} from "../services/professional/invitations";
import {AuthScreen} from "./AuthScreen";


type Choice={kind:"new"}|{kind:"existing";petId:string};


type InviteError={message:string;code?:string};


function speciesIcon(species:Species){return species==="dog"?"🐶":"🐈";}
function speciesLabel(species:Species){return species==="dog"?"Cachorro":"Gato";}


function inviteError(error:unknown):InviteError{
  const raw=appErrorText(error,"");
  if(raw.includes("INVITATION_EMAIL_MISMATCH"))return{code:"email",message:"Este convite foi enviado para outro e-mail. Entre com o mesmo endereço que recebeu o convite para continuar."};
  if(raw.includes("INVITATION_EXPIRED"))return{code:"expired",message:"Este convite venceu antes da confirmação. Peça ao profissional um novo link."};
  if(raw.includes("INVITATION_ALREADY_ACCEPTED"))return{code:"accepted",message:"Este convite já foi aceito por outra conta."};
  if(raw.includes("INVITATION_ALREADY_RESOLVED"))return{code:"inactive",message:"Este convite já foi concluído por outra conta."};
  if(raw.includes("INVITATION_NOT_PENDING"))return{code:"inactive",message:"Este convite não está mais disponível. Peça ao profissional um novo link."};
  if(raw.includes("PET_NOT_OWNED_BY_TUTOR")||raw.includes("PET_NOT_ACTIVE")||raw.includes("PET_SPECIES_MISMATCH"))return{code:"pet",message:"O animal selecionado não pode mais ser usado neste convite. Atualize a tela e escolha novamente."};
  if(raw.includes("PROFESSIONAL_CASE_INTEGRITY_ERROR")||raw.includes("PROFESSIONAL_PATIENT_INTEGRITY_ERROR")||raw.includes("ACCEPTED_INVITATION_INTEGRITY_ERROR")||raw.includes("RESOLVED_INVITATION_INTEGRITY_ERROR")||raw.includes("ACTIVE_RELATIONSHIP_CONFLICT"))return{code:"integrity",message:"Encontramos um problema no acompanhamento já existente. Nenhum dado foi alterado. Peça ao profissional para revisar o cadastro antes de continuar."};
  if(raw.includes("PET_ALREADY_LINKED_TO_PROFESSIONAL"))return{code:"linked",message:"Este animal já possui um acompanhamento ativo com este profissional."};
  return{message:"Não foi possível concluir o acompanhamento agora. Sua escolha foi preservada; tente novamente."};
}


function formatExpiry(value:string|null){
  if(!value)return null;
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return null;
  return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(date);
}


function PetLine({pet}:{pet:Pet}){
  return <><span className="professional-pet-icon small">{pet.icon||speciesIcon(pet.species)}</span><span className="invite-pet-line"><strong>{pet.name}</strong><small>{speciesLabel(pet.species)}{pet.breed?` · ${pet.breed}`:""}</small></span></>;
}


function InviteIdentity({
  isAuthenticated,
  email,
  canSwitchAccount,
  switching,
  onSwitchAccount,
}:{
  isAuthenticated:boolean;
  email:string|null;
  canSwitchAccount:boolean;
  switching:boolean;
  onSwitchAccount:()=>Promise<void>;
}){
  const accountLabel=email?.trim()||"Conta autenticada";
  const initial=(email?.trim().charAt(0)||"U").toUpperCase();
  return <div className={`invite-identity ${isAuthenticated?"is-authenticated":"is-visitor"}`} aria-label="Estado da sessão">
    <span className={`invite-identity-avatar ${isAuthenticated?"":"is-visitor"}`}>{isAuthenticated?initial:"?"}</span>
    <span className="invite-identity-copy"><strong>{isAuthenticated?"Conta atual":"Visitante"}</strong><small>{isAuthenticated?accountLabel:"não autenticado"}</small></span>
    {isAuthenticated&&canSwitchAccount&&<button className="link-button invite-identity-action" type="button" disabled={switching} onClick={()=>void onSwitchAccount()}>{switching?"Saindo…":"Trocar conta"}</button>}
  </div>;
}


function TerminalInvite({
  preview,
  missing,
  onFinish,
}:{
  preview:ProfessionalInvitationPreview|null;
  missing?:boolean;
  onFinish:()=>Promise<void>|void;
}){
  const status=preview?.status;
  const content=missing
    ?{title:"Convite não encontrado",text:"O link pode estar incompleto ou não ser mais válido."}
    :status==="expired"
      ?{title:"Este convite venceu",text:"Peça ao profissional um novo link para concluir o vínculo."}
      :status==="revoked"
        ?{title:"Este convite foi substituído",text:"Use o link mais recente enviado pelo profissional."}
        :status==="resolved"
          ?{title:"Acompanhamento já identificado",text:"Este convite foi concluído porque este pet já possuía acompanhamento ativo com o mesmo profissional."}
          :{title:"Convite já concluído",text:"Este link já foi utilizado. Se foi você quem aceitou, o acompanhamento já está ativo no Rotina Pet."};


  return <main className="center-page professional-invite-shell"><section className="auth-card professional-terminal-card">
    <div className="brand-mark">🐾</div><p className="eyebrow">Rotina Pet</p><h1>{content.title}</h1><p className="muted readable">{content.text}</p>
    <button className="primary-button" type="button" onClick={()=>void onFinish()}>Ir para o Rotina Pet</button>
  </section></main>;
}


export function ProfessionalInvitationPage({
  token,
  pets,
  loadingPets,
  isAuthenticated,
  accountEmail,
  acceptedIntent,
  onAcceptIntent,
  onFinish,
  onSwitchAccount,
}:{
  token:string;
  pets:Pet[];
  loadingPets:boolean;
  isAuthenticated:boolean;
  accountEmail:string|null;
  acceptedIntent:boolean;
  onAcceptIntent:()=>void;
  onFinish:()=>Promise<void>|void;
  onSwitchAccount:()=>Promise<void>|void;
}){
  const[preview,setPreview]=useState<ProfessionalInvitationPreview|null>(null);
  const[previewLoading,setPreviewLoading]=useState(true);
  const[previewError,setPreviewError]=useState("");
  const[missing,setMissing]=useState(false);
  const[choice,setChoice]=useState<Choice|null>(null);
  const[manualOpen,setManualOpen]=useState(false);
  const[accepting,setAccepting]=useState(false);
  const[acceptError,setAcceptError]=useState<InviteError|null>(null);
  const[switchingAccount,setSwitchingAccount]=useState(false);
  const[switchAccountError,setSwitchAccountError]=useState("");
  const[result,setResult]=useState<AcceptProfessionalInvitationResult|null>(null);


  async function loadPreview(){
    setPreviewLoading(true);
    setPreviewError("");
    setMissing(false);
    const normalizedToken=token.trim();
    if(!normalizedToken){
      setPreview(null);
      setMissing(true);
      setPreviewLoading(false);
      return;
    }
    try{
      const next=await getProfessionalInvitationPreview(normalizedToken);
      if(!next){setMissing(true);setPreview(null);return;}
      setPreview(next);
    }catch(err){
      console.error("Não foi possível consultar o convite profissional.",err);
      setPreviewError("Não foi possível consultar este convite. Verifique sua conexão e tente novamente.");
    }finally{
      setPreviewLoading(false);
    }
  }


  useEffect(()=>{void loadPreview();},[token]);


  const resolution=useMemo<InvitationPetResolution|null>(()=>preview?.status==="pending"&&acceptedIntent&&isAuthenticated&&!loadingPets?resolveInvitationPets(preview,pets):null,[preview,pets,loadingPets,acceptedIntent,isAuthenticated]);


  useEffect(()=>{
    if(!acceptedIntent||!isAuthenticated){setChoice(null);setManualOpen(false);return;}
    if(!resolution)return;
    setManualOpen(false);
    setAcceptError(null);
    if(resolution.mode==="suggestion")setChoice(null);
    else setChoice({kind:"new"});
  },[preview?.invitationId,resolution?.mode]);


  const selectedPet=choice?.kind==="existing"?pets.find(pet=>pet.id===choice.petId)??null:null;
  const expiry=preview?formatExpiry(preview.expiresAt):null;


  async function accept(){
    if(!preview||preview.status!=="pending"||!choice)return;
    setAccepting(true);
    setAcceptError(null);
    try{
      const accepted=await acceptProfessionalInvitation(token,choice.kind==="existing"?choice.petId:null);
      setResult(accepted);
    }catch(err){
      setAcceptError(inviteError(err));
    }finally{
      setAccepting(false);
    }
  }


  async function switchAccount(){
    setSwitchingAccount(true);
    setSwitchAccountError("");
    try{
      await onSwitchAccount();
      setAcceptError(null);
    }catch(err){
      console.error("Não foi possível trocar a conta do convite profissional.",err);
      setSwitchAccountError("Não foi possível sair desta conta agora. Tente novamente.");
    }finally{
      setSwitchingAccount(false);
    }
  }


  if(previewLoading)return <main className="center-page professional-invite-shell"><section className="auth-card professional-invite-loading"><div className="spinner large"/><p className="muted">Abrindo convite…</p></section></main>;


  if(previewError)return <main className="center-page professional-invite-shell"><section className="auth-card"><div className="brand-mark">🐾</div><p className="eyebrow">Convite profissional</p><h1>Não foi possível abrir</h1><p className="error-box">{previewError}</p><div className="button-row"><button className="primary-button" onClick={()=>void loadPreview()}>Tentar novamente</button><button className="secondary-button" onClick={()=>void onFinish()}>Voltar ao app</button></div></section></main>;


  if(missing||!preview)return <TerminalInvite preview={null} missing onFinish={onFinish}/>;
  if(preview.status!=="pending")return <TerminalInvite preview={preview} onFinish={onFinish}/>;


  if(acceptedIntent&&!isAuthenticated)return <AuthScreen context="professional-invite" returnUrl={buildProfessionalInvitationUrl(token,true)}/>;


  if(result){
    const alreadyActive=result.resolution==="already_active";
    return <main className="center-page professional-invite-shell"><section className="auth-card professional-success-card">
      <div className="invite-success-mark">✓</div><p className="eyebrow">Tudo certo</p><h1>{alreadyActive?"Este acompanhamento já estava ativo":`${preview.petName} foi conectado`}</h1>
      <p className="muted readable">{alreadyActive
        ?<><strong>{preview.petName}</strong> já estava sendo acompanhado por <strong>{preview.professionalName}</strong>{preview.clinicName?` · ${preview.clinicName}`:""}. Este convite foi encerrado sem criar outro acompanhamento.</>
        :<><strong>{preview.professionalName}</strong>{preview.clinicName?` · ${preview.clinicName}`:""} agora pode acompanhar este animal no Rotina Pet.</>}</p>
      <p className="invite-permission-note">{alreadyActive
        ?"Não criamos outro acompanhamento nem alteramos o histórico de peso por causa deste convite."
        :"O acesso profissional fica limitado a este pet e ao acompanhamento que você acabou de autorizar."}</p>
      <button className="primary-button" type="button" onClick={()=>void onFinish()}>Continuar no Rotina Pet</button>
    </section></main>;
  }


  return <main className="professional-invite-shell">
    <section className="professional-invite-page">
      <header className="professional-invite-brand"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt=""/><span>Rotina Pet</span></header>
      <InviteIdentity isAuthenticated={isAuthenticated} email={accountEmail} canSwitchAccount={acceptedIntent} switching={switchingAccount} onSwitchAccount={switchAccount}/>
      {switchAccountError&&<p className="error-box invite-switch-error">{switchAccountError}</p>}


      <article className="professional-invite-card">
        <p className="eyebrow">Convite de acompanhamento</p>
        <h1>{preview.professionalName} quer acompanhar {preview.petName}</h1>
        {preview.clinicName&&<p className="professional-invite-clinic">{preview.clinicName}</p>}
        <div className="invite-pet-summary"><span className="professional-pet-icon">{speciesIcon(preview.species)}</span><div><strong>{preview.petName}</strong><span>{speciesLabel(preview.species)}{preview.breed?` · ${preview.breed}`:""}</span></div></div>
        {expiry&&<p className="invite-validity">Convite válido até {expiry}.</p>}
      </article>


      {!acceptedIntent?<section className="professional-invite-card invite-resolution-card">
        <div className="invite-consent-block">
          <p className="invite-consent-copy">Ao aceitar, você concorda em conectar <strong>{preview.petName}</strong> a <strong>{preview.professionalName}</strong> para acompanhamento no Rotina Pet. O profissional não recebe acesso geral à sua conta.</p>
          <p className="muted readable">Depois, vamos apenas identificar você e confirmar qual perfil do pet deve ser conectado.</p>
          <button className="primary-button invite-confirm-button" type="button" onClick={onAcceptIntent}>Aceitar convite</button>
          <button className="link-button" type="button" onClick={()=>void onFinish()}>Agora não</button>
        </div>
      </section>:
      loadingPets||!resolution?<section className="professional-invite-card invite-resolution-loading"><div className="spinner"/><span>Conferindo seus animais…</span></section>:
        <section className="professional-invite-card invite-resolution-card">
          {resolution.mode==="suggestion"&&<div className="invite-suggestion">
            <p className="eyebrow">Possível correspondência</p>
            <h2>{resolution.suggestion.strength==="strong"?`Você já tem ${resolution.suggestion.pet.name} no Rotina Pet`:"Encontramos um pet parecido no Rotina Pet"}</h2>
            <div className="invite-candidate"><PetLine pet={resolution.suggestion.pet}/></div>
            <p className="muted">É o mesmo animal?</p>
            <div className="invite-choice-actions">
              <button className={choice?.kind==="existing"?"primary-button":"secondary-button"} type="button" onClick={()=>setChoice({kind:"existing",petId:resolution.suggestion.pet.id})}>Usar {resolution.suggestion.pet.name}</button>
              <button className={choice?.kind==="new"?"secondary-button selected-choice":"link-button"} type="button" onClick={()=>setChoice({kind:"new"})}>Não, criar novo pet</button>
            </div>
          </div>}


          {resolution.mode==="manual"&&<div className="invite-manual-disclosure">
            {!manualOpen?<button className="link-button invite-tertiary-action" type="button" onClick={()=>setManualOpen(true)}>Este pet já está cadastrado?</button>:
              <div className="invite-manual-picker">
                <div className="invite-manual-heading"><div><p className="eyebrow">Pets compatíveis</p><h2>Qual deles é {preview.petName}?</h2></div><button className="link-button" type="button" onClick={()=>{setManualOpen(false);setChoice({kind:"new"});}}>Fechar</button></div>
                <div className="invite-pet-options">
                  {resolution.compatiblePets.map(pet=><button key={pet.id} type="button" className={`invite-pet-option ${choice?.kind==="existing"&&choice.petId===pet.id?"selected":""}`} onClick={()=>setChoice({kind:"existing",petId:pet.id})}><PetLine pet={pet}/><span className="invite-option-check">✓</span></button>)}
                </div>
                <button className="link-button" type="button" onClick={()=>{setChoice({kind:"new"});setManualOpen(false);}}>Nenhum deles — criar novo pet</button>
              </div>}
          </div>}


          <div className="invite-consent-block">
            {choice?.kind==="existing"&&selectedPet?<p className="invite-choice-summary">O convite será ligado a <strong>{selectedPet.name}</strong>, que já está na sua conta.</p>:choice?.kind==="new"?<p className="invite-choice-summary">Será criado um perfil de <strong>{preview.petName}</strong> na sua conta ao confirmar.</p>:<p className="invite-choice-summary muted">Escolha acima se este é o mesmo animal antes de continuar.</p>}
            <p className="invite-consent-copy">Sua autorização vale somente para <strong>{preview.petName}</strong>. Agora confirme qual perfil será conectado ao profissional.</p>
            {acceptError?.code==="email"?<div className="invite-account-mismatch" role="alert">
              <p className="eyebrow">Conta diferente</p>
              <h2>Este convite foi enviado para outra conta</h2>
              <p>Para autorizar o acompanhamento de <strong>{preview.petName}</strong>, entre com o e-mail que recebeu este convite.</p>
              <button className="primary-button" type="button" disabled={switchingAccount} onClick={()=>void switchAccount()}>{switchingAccount?"Saindo…":"Entrar com outra conta"}</button>
            </div>:acceptError?.code==="integrity"?<div className="invite-account-mismatch" role="alert">
              <p className="eyebrow">Revisão necessária</p>
              <h2>Este convite precisa ser revisado</h2>
              <p>{acceptError.message}</p>
              <button className="secondary-button" type="button" onClick={()=>void onFinish()}>Ir para o Rotina Pet</button>
            </div>:<>
              {acceptError&&<div className="error-box invite-accept-error"><span>{acceptError.message}</span></div>}
              <button className="primary-button invite-confirm-button" type="button" disabled={!choice||accepting} onClick={()=>void accept()}>{accepting?"Conectando…":"Concluir vínculo"}</button>
              {acceptError&&!acceptError.code&&<button className="link-button" type="button" disabled={accepting} onClick={()=>void accept()}>Tentar novamente</button>}
              {acceptError&&acceptError.code&&<button className="link-button" type="button" onClick={()=>void onFinish()}>Voltar ao Rotina Pet</button>}
            </>}
          </div>
        </section>}
    </section>
  </main>;
}