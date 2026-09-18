import {useEffect,useMemo,useState} from "react";
import type {Species} from "../types";
import type {ProfessionalPatient,ProfessionalProfile,ProfessionalProfileInput} from "../types/professional";
import {appErrorText} from "../lib/errors";
import {buildProfessionalInvitationUrl} from "../lib/professionalInvite";
import {createProfessionalInvitation} from "../services/professional/invitations";
import {createPreliminaryPatient,listProfessionalPatients,updatePreliminaryPatient} from "../services/professional/patients";
import {getProfessionalProfile,hasVeterinarianRole,upsertProfessionalProfile} from "../services/professional/profile";

type View="home"|"profile"|"patient"|"share";

type InviteShare={
  patient:ProfessionalPatient;
  expiresAt:string;
  url:string;
};

function isProfileComplete(profile:ProfessionalProfile|null){
  return Boolean(profile?.display_name.trim()&&profile.crmv?.trim()&&profile.crmv_state?.trim());
}

function formatExpiry(value:string){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return value;
  return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(date);
}

function speciesLabel(species:Species){return species==="dog"?"Cachorro":"Gato";}
function speciesIcon(species:Species){return species==="dog"?"🐶":"🐈";}

function professionalError(error:unknown,fallback:string){
  const raw=appErrorText(error,"");
  if(/user_roles|professional_profiles|professional_patients|create_professional_invitation/i.test(raw)&&/does not exist|schema cache|could not find/i.test(raw)){
    return "A infraestrutura profissional ainda não está disponível neste ambiente. A migration da Etapa 1B precisa ser aplicada antes do piloto.";
  }
  if(raw.includes("VETERINARIAN_ROLE_REQUIRED"))return "Ative o perfil profissional antes de gerar convites.";
  if(raw.includes("PROFESSIONAL_PROFILE_REQUIRED"))return "Complete o perfil profissional antes de gerar convites.";
  if(raw.includes("PROFESSIONAL_PATIENT_NOT_INVITABLE"))return "Este paciente não aceita um novo convite neste estado.";
  if(raw.includes("INVITATION_EMAIL_INVALID")||raw.includes("INVITATION_EMAIL_REQUIRED"))return "Confira o e-mail do tutor antes de gerar o convite.";
  if(/failed to fetch|network|load failed/i.test(raw))return "Não foi possível conectar ao Rotina Pet agora. Verifique sua conexão e tente novamente.";
  return fallback;
}

async function copyText(value:string){
  if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea=document.createElement("textarea");
  textarea.value=value;
  textarea.style.position="fixed";
  textarea.style.opacity="0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function ProfileForm({
  profile,
  activating,
  onSave,
  onCancel,
}:{
  profile:ProfessionalProfile|null;
  activating:boolean;
  onSave:(input:ProfessionalProfileInput)=>Promise<void>;
  onCancel?:()=>void;
}){
  const[displayName,setDisplayName]=useState(profile?.display_name??"");
  const[crmv,setCrmv]=useState(profile?.crmv??"");
  const[crmvState,setCrmvState]=useState(profile?.crmv_state??"");
  const[credentials,setCredentials]=useState(profile?.credentials??"");
  const[clinicName,setClinicName]=useState(profile?.clinic_name??"");
  const[professionalEmail,setProfessionalEmail]=useState(profile?.professional_email??"");
  const[professionalPhone,setProfessionalPhone]=useState(profile?.professional_phone??"");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");

  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(crmvState.trim().length!==2){setError("Informe a UF do CRMV com duas letras.");return;}
    setBusy(true);
    setError("");
    try{
      await onSave({
        displayName,
        crmv,
        crmvState,
        credentials,
        clinicName,
        professionalEmail,
        professionalPhone,
      });
    }catch(err){
      setError(professionalError(err,"Não foi possível salvar o perfil profissional."));
    }finally{
      setBusy(false);
    }
  }

  return <section className="professional-narrow">
    <div className="professional-page-head">
      <div><p className="eyebrow">Área profissional</p><h1>{activating?"Ative seu perfil profissional":"Perfil profissional"}</h1></div>
      {onCancel&&<button className="link-button" type="button" onClick={onCancel}>Voltar</button>}
    </div>
    <p className="muted readable">A mesma conta pode continuar sendo usada normalmente como tutora. Para o piloto, pedimos apenas os dados essenciais para identificar quem está acompanhando o animal.</p>
    <form className="panel-card stack-form professional-form" onSubmit={submit}>
      <label>Nome profissional<input required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Ex.: Dra. Ana Souza"/></label>
      <div className="form-grid professional-two-columns">
        <label>CRMV<input required value={crmv} onChange={e=>setCrmv(e.target.value)} placeholder="12345"/></label>
        <label>UF do CRMV<input required maxLength={2} value={crmvState} onChange={e=>setCrmvState(e.target.value.toUpperCase())} placeholder="SP"/></label>
      </div>
      <label>Clínica <span className="optional-label">opcional</span><input value={clinicName} onChange={e=>setClinicName(e.target.value)} placeholder="Nome da clínica ou consultório"/></label>
      <label>Títulos / especialidade <span className="optional-label">opcional</span><input value={credentials} onChange={e=>setCredentials(e.target.value)} placeholder="Ex.: Nutrologia veterinária"/></label>
      <div className="form-grid professional-two-columns">
        <label>E-mail profissional <span className="optional-label">opcional</span><input type="email" value={professionalEmail} onChange={e=>setProfessionalEmail(e.target.value)}/></label>
        <label>Telefone <span className="optional-label">opcional</span><input value={professionalPhone} onChange={e=>setProfessionalPhone(e.target.value)}/></label>
      </div>
      {error&&<p className="error-box">{error}</p>}
      <div className="button-row professional-form-actions">
        {onCancel&&<button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>}
        <button className="primary-button" disabled={busy}>{busy?"Salvando…":activating?"Ativar área profissional":"Salvar perfil"}</button>
      </div>
    </form>
  </section>;
}

function PatientForm({
  existing,
  onSubmit,
  onCancel,
}:{
  existing?:ProfessionalPatient|null;
  onSubmit:(input:{petName:string;species:Species;breed:string;tutorEmail:string;initialWeightKg:number|null;initialWeightRecordedAt:string|null})=>Promise<void>;
  onCancel:()=>void;
}){
  const[petName,setPetName]=useState(existing?.pet_name??"");
  const[species,setSpecies]=useState<Species>(existing?.species??"cat");
  const[breed,setBreed]=useState(existing?.breed??"");
  const[tutorEmail,setTutorEmail]=useState(existing?.tutor_email??"");
  const[weight,setWeight]=useState(existing?.initial_weight_kg!=null?String(existing.initial_weight_kg).replace(".",","):"");
  const[weightDate,setWeightDate]=useState(existing?.initial_weight_recorded_at??"");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");

  async function submit(event:React.FormEvent){
    event.preventDefault();
    const normalizedWeight=weight.trim()?Number(weight.replace(",",".")):null;
    if(normalizedWeight!=null&&(!Number.isFinite(normalizedWeight)||normalizedWeight<=0)){
      setError("Informe um peso válido maior que zero.");
      return;
    }
    setBusy(true);
    setError("");
    try{
      await onSubmit({
        petName,
        species,
        breed,
        tutorEmail,
        initialWeightKg:normalizedWeight,
        initialWeightRecordedAt:normalizedWeight!=null&&weightDate?weightDate:null,
      });
    }catch(err){
      setError(professionalError(err,"Não foi possível cadastrar o paciente."));
    }finally{
      setBusy(false);
    }
  }

  return <section className="professional-narrow">
    <div className="professional-page-head">
      <div><p className="eyebrow">Novo vínculo</p><h1>{existing?"Complete o paciente":"Cadastrar paciente"}</h1></div>
      <button className="link-button" type="button" onClick={onCancel}>Voltar</button>
    </div>
    <p className="muted readable">Este cadastro ainda não cria um animal na conta do tutor. O pet só será criado — ou ligado a um já existente — quando o convite for aceito.</p>
    <form className="panel-card stack-form professional-form" onSubmit={submit}>
      <div className="form-grid professional-two-columns">
        <label>Nome do pet<input required value={petName} onChange={e=>setPetName(e.target.value)} placeholder="Luna"/></label>
        <label>Espécie<select value={species} onChange={e=>setSpecies(e.target.value as Species)}><option value="cat">Gato</option><option value="dog">Cachorro</option></select></label>
      </div>
      <label>Raça <span className="optional-label">opcional</span><input value={breed} onChange={e=>setBreed(e.target.value)} placeholder="SRD, Golden Retriever…"/></label>
      <label>E-mail do tutor<input type="email" required value={tutorEmail} onChange={e=>setTutorEmail(e.target.value)} placeholder="tutor@exemplo.com"/></label>
      <div className="form-grid professional-two-columns">
        <label>Peso inicial em kg <span className="optional-label">opcional</span><input inputMode="decimal" min="0.01" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="4,2"/></label>
        <label>Data do peso <span className="optional-label">opcional</span><input type="date" value={weightDate} disabled={!weight.trim()} onChange={e=>setWeightDate(e.target.value)}/></label>
      </div>
      <p className="form-helper">Se houver peso inicial, ele só entra no histórico quando o tutor concluir o vínculo.</p>
      {error&&<p className="error-box">{error}</p>}
      <div className="button-row professional-form-actions">
        <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="primary-button" disabled={busy}>{busy?"Salvando…":"Salvar e gerar convite"}</button>
      </div>
    </form>
  </section>;
}

function ShareInvite({share,onClose}:{share:InviteShare;onClose:()=>void}){
  const[copied,setCopied]=useState(false);
  const[shareError,setShareError]=useState("");

  async function copy(){
    setShareError("");
    try{
      await copyText(share.url);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),2200);
    }catch{
      setShareError("Não foi possível copiar automaticamente. Selecione o link abaixo e copie manualmente.");
    }
  }

  async function nativeShare(){
    if(!("share" in navigator)){await copy();return;}
    setShareError("");
    try{
      await navigator.share({title:`Convite para ${share.patient.pet_name}`,text:"Convite do Rotina Pet para acompanhamento profissional.",url:share.url});
    }catch(err){
      if(err instanceof DOMException&&err.name==="AbortError")return;
      setShareError("Não foi possível abrir o compartilhamento. Você pode copiar o link.");
    }
  }

  return <section className="professional-narrow">
    <div className="professional-page-head"><div><p className="eyebrow">Convite pronto</p><h1>Envie para o tutor</h1></div></div>
    <article className="panel-card invite-share-card">
      <div className="professional-pet-title"><span className="professional-pet-icon">{speciesIcon(share.patient.species)}</span><div><h2>{share.patient.pet_name}</h2><p>{speciesLabel(share.patient.species)}{share.patient.breed?` · ${share.patient.breed}`:""}</p></div></div>
      <p className="muted readable">O link é exibido somente nesta tela. Se você precisar de outro depois, gere um novo convite; o link pendente anterior será invalidado.</p>
      <label className="invite-link-field">Link do convite<input readOnly value={share.url} onFocus={event=>event.currentTarget.select()}/></label>
      <p className="invite-expiry">Válido até <strong>{formatExpiry(share.expiresAt)}</strong></p>
      {shareError&&<p className="notice">{shareError}</p>}
      {copied&&<p className="success-box">Link copiado.</p>}
      <div className="button-row invite-share-actions">
        <button className="primary-button" type="button" onClick={()=>void copy()}>{copied?"Copiado":"Copiar link"}</button>
        {"share" in navigator&&<button className="secondary-button" type="button" onClick={()=>void nativeShare()}>Compartilhar</button>}
      </div>
    </article>
    <button className="link-button professional-center-link" type="button" onClick={onClose}>Concluir</button>
  </section>;
}

export function ProfessionalAreaPage(){
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[hasRole,setHasRole]=useState(false);
  const[profile,setProfile]=useState<ProfessionalProfile|null>(null);
  const[patients,setPatients]=useState<ProfessionalPatient[]>([]);
  const[view,setView]=useState<View>("home");
  const[editingPatient,setEditingPatient]=useState<ProfessionalPatient|null>(null);
  const[share,setShare]=useState<InviteShare|null>(null);
  const[generationId,setGenerationId]=useState<string|null>(null);

  const profileComplete=isProfileComplete(profile);
  const pendingPatients=useMemo(()=>patients.filter(patient=>patient.status==="draft"||patient.status==="invited"),[patients]);

  async function load(){
    setLoading(true);
    setError("");
    try{
      const[role,nextProfile,nextPatients]=await Promise.all([
        hasVeterinarianRole(),
        getProfessionalProfile(),
        listProfessionalPatients(),
      ]);
      setHasRole(role);
      setProfile(nextProfile);
      setPatients(nextPatients);
    }catch(err){
      setError(professionalError(err,"Não foi possível abrir a área profissional."));
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load();},[]);

  async function saveProfile(input:ProfessionalProfileInput){
    const saved=await upsertProfessionalProfile(input);
    setProfile(saved);
    setHasRole(true);
    setView("home");
  }

  async function generate(patient:ProfessionalPatient){
    if(!patient.tutor_email)throw new Error("Informe o e-mail do tutor antes de gerar o convite.");
    setGenerationId(patient.id);
    setError("");
    try{
      const invitation=await createProfessionalInvitation({professionalPatientId:patient.id,tutorEmail:patient.tutor_email});
      const updated={...patient,status:"invited" as const};
      setPatients(current=>current.map(item=>item.id===patient.id?updated:item));
      setShare({patient:updated,expiresAt:invitation.expiresAt,url:buildProfessionalInvitationUrl(invitation.token)});
      setView("share");
    }catch(err){
      setError(professionalError(err,"Não foi possível gerar o convite."));
      throw err;
    }finally{
      setGenerationId(null);
    }
  }

  async function savePatient(input:{petName:string;species:Species;breed:string;tutorEmail:string;initialWeightKg:number|null;initialWeightRecordedAt:string|null}){
    const patient=editingPatient
      ?await updatePreliminaryPatient(editingPatient.id,input)
      :await createPreliminaryPatient(input);
    setPatients(current=>{
      const exists=current.some(item=>item.id===patient.id);
      return exists?current.map(item=>item.id===patient.id?patient:item):[patient,...current];
    });
    setEditingPatient(patient);
    await generate(patient);
    setEditingPatient(null);
  }

  if(loading)return <section className="professional-page professional-loading"><div className="spinner large"/><p className="muted">Abrindo área profissional…</p></section>;

  if(error&&!profile&&!patients.length){
    return <section className="professional-narrow"><div className="professional-page-head"><div><p className="eyebrow">Área profissional</p><h1>Não foi possível carregar</h1></div></div><p className="error-box error-with-action"><span>{error}</span><button className="secondary-button compact" onClick={()=>void load()}>Tentar novamente</button></p></section>;
  }

  if(view==="profile"||!hasRole||!profileComplete){
    return <ProfileForm profile={profile} activating={!hasRole||!profileComplete} onSave={saveProfile} onCancel={hasRole&&profileComplete?()=>setView("home"):undefined}/>;
  }

  if(view==="patient"){
    return <PatientForm existing={editingPatient} onSubmit={savePatient} onCancel={()=>{setEditingPatient(null);setView("home");}}/>;
  }

  if(view==="share"&&share){
    return <ShareInvite share={share} onClose={()=>{setShare(null);setView("home");}}/>;
  }

  return <section className="professional-page">
    <div className="professional-page-head professional-home-head">
      <div><p className="eyebrow">Área profissional</p><h1>Atendimento</h1><p className="muted">Piloto profissional · vínculo seguro entre veterinária e tutor.</p></div>
      <button className="primary-button" type="button" onClick={()=>{setEditingPatient(null);setView("patient");}}>Novo paciente</button>
    </div>

    {error&&<p className="error-box error-with-action"><span>{error}</span><button className="secondary-button compact" onClick={()=>setError("")}>Fechar</button></p>}

    <article className="professional-profile-strip">
      <div><span className="professional-profile-avatar">{profile?.display_name.trim().charAt(0).toUpperCase()}</span><div><strong>{profile?.display_name}</strong><span>{profile?.crmv_state&&profile.crmv?`CRMV-${profile.crmv_state} ${profile.crmv}`:"Perfil profissional"}{profile?.clinic_name?` · ${profile.clinic_name}`:""}</span></div></div>
      <button className="link-button" type="button" onClick={()=>setView("profile")}>Editar perfil</button>
    </article>

    <section className="professional-worklist">
      <div className="section-heading"><div><p className="eyebrow">Em andamento</p><h2>Convites e cadastros preliminares</h2></div></div>
      {pendingPatients.length===0?<div className="professional-empty"><span>🐾</span><h3>Nenhum convite pendente</h3><p>Cadastre um paciente quando estiver pronta para iniciar um vínculo.</p></div>:
        <div className="professional-patient-list">
          {pendingPatients.map(patient=><div className="professional-patient-row" key={patient.id}>
            <div className="professional-patient-main"><span className="professional-pet-icon small">{speciesIcon(patient.species)}</span><div><strong>{patient.pet_name}</strong><span>{speciesLabel(patient.species)}{patient.breed?` · ${patient.breed}`:""}</span><small>{patient.tutor_email??"E-mail do tutor ainda não informado"}</small></div></div>
            <div className="professional-patient-actions">
              <span className={`professional-status ${patient.status}`}>{patient.status==="invited"?"Convite enviado":"Rascunho"}</span>
              {patient.tutor_email?<button className="secondary-button compact" type="button" disabled={generationId===patient.id} onClick={()=>void generate(patient).catch(()=>{})}>{generationId===patient.id?"Gerando…":patient.status==="invited"?"Gerar novo link":"Gerar convite"}</button>:<button className="secondary-button compact" type="button" onClick={()=>{setEditingPatient(patient);setView("patient");}}>Completar</button>}
            </div>
          </div>)}
        </div>}
    </section>
  </section>;
}
