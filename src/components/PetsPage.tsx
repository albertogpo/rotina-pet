import {useEffect,useState} from "react";
import type {Pet,Species} from "../types";
import {PetForm} from "./PetForm";

export function PetsPage({pets,archivedPets,onCreate,onUpdate,onArchive,onRestore,autoStartCreate,onAutoStartHandled}:{pets:Pet[];archivedPets:Pet[];onCreate:(input:{name:string;species:Species;icon:string})=>Promise<Pet|void>;onUpdate:(id:string,input:{name:string;species:Species;icon:string})=>Promise<void>;onArchive:(id:string)=>Promise<void>;onRestore:(id:string)=>Promise<void>;autoStartCreate:boolean;onAutoStartHandled:()=>void}){
  const[editing,setEditing]=useState<Pet|null>(null);
  const[adding,setAdding]=useState(false);
  const[busy,setBusy]=useState(false);
  const[busyPetId,setBusyPetId]=useState("");
  const[error,setError]=useState("");

  useEffect(()=>{
    if(!autoStartCreate)return;
    setAdding(true);
    setEditing(null);
    onAutoStartHandled();
  },[autoStartCreate,onAutoStartHandled]);

  async function save(input:{name:string;species:Species;icon:string}){
    setBusy(true);
    setError("");
    try{
      if(editing)await onUpdate(editing.id,input);else await onCreate(input);
      setEditing(null);
      setAdding(false);
    }catch(err){
      setError(err instanceof Error?err.message:"Não foi possível salvar.");
    }finally{
      setBusy(false);
    }
  }

  async function restore(pet:Pet){
    setBusyPetId(pet.id);
    setError("");
    try{await onRestore(pet.id);}catch(err){setError(err instanceof Error?err.message:"Não foi possível restaurar o perfil.");}finally{setBusyPetId("");}
  }

  return <section className="page-grid">
    <article className="panel-card">
      <div className="section-heading"><div><p className="eyebrow">Animais</p><h2>Perfis individuais</h2><p className="muted">Cada animal mantém seus próprios planos, pesos e histórico.</p></div><button className="primary-button compact" onClick={()=>{setAdding(true);setEditing(null);}}>＋ Animal</button></div>
      {(adding||editing)&&<div className="embedded-form"><h3>{editing?`Editar ${editing.name}`:"Novo animal"}</h3><PetForm pet={editing??undefined} onSave={save} onCancel={()=>{setAdding(false);setEditing(null);}} busy={busy}/>{error&&<p className="error-box">{error}</p>}</div>}
      {!pets.length?<div className="inline-empty"><p>Nenhum animal ativo no momento.</p></div>:<div className="pet-grid">{pets.map(pet=><article className="pet-profile" key={pet.id}><span className="pet-profile-icon">{pet.icon}</span><div><h3>{pet.name}</h3><p>{pet.species==="cat"?"Gato":"Cachorro"}</p></div><div className="row-actions"><button onClick={()=>{setEditing(pet);setAdding(false);}}>Editar</button><button className="danger-text" onClick={()=>{if(confirm(`Arquivar o perfil de ${pet.name}? O histórico será preservado.`))void onArchive(pet.id);}}>Arquivar</button></div></article>)}</div>}
    </article>

    <article className="panel-card archived-panel">
      <div><p className="eyebrow">Arquivo</p><h2>Animais arquivados</h2><p className="muted readable">Arquivar não apaga nada. Pesos, planos e refeições continuam no banco e voltam a aparecer quando o perfil é restaurado.</p></div>
      {!archivedPets.length?<p className="muted">Nenhum animal arquivado.</p>:<div className="item-list">{archivedPets.map(pet=><div className="item-row archived-pet-row" key={pet.id}><div className="archived-pet-identity"><span>{pet.icon}</span><div><strong>{pet.name}</strong><span>{pet.species==="cat"?"Gato":"Cachorro"}</span></div></div><button className="secondary-button compact" disabled={busyPetId===pet.id} onClick={()=>void restore(pet)}>{busyPetId===pet.id?"Restaurando…":"Restaurar"}</button></div>)}</div>}
      {error&&!adding&&!editing&&<p className="error-box">{error}</p>}
    </article>
  </section>;
}
