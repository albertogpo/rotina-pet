import {useState} from "react";
import {sendPasswordReset,signIn,signUp} from "../services/api";

type AuthContext="default"|"professional-invite";

export function AuthScreen({
  context="default",
  returnUrl,
}:{
  context?:AuthContext;
  returnUrl?:string;
}){
  const[mode,setMode]=useState<"login"|"signup">("login");
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  const[error,setError]=useState("");
  const isInvite=context==="professional-invite";

  async function submit(event:React.FormEvent){
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try{
      if(mode==="login"){
        await signIn(email,password);
      }else{
        const data=await signUp(email,password,returnUrl);
        if(!data.session){
          setMessage(isInvite
            ?"Conta criada. Confirme seu e-mail e você voltará para este convite automaticamente."
            :"Conta criada. Confira seu e-mail para confirmar o cadastro.");
        }
      }
    }catch(err){
      setError(err instanceof Error?err.message:"Não foi possível continuar.");
    }finally{
      setBusy(false);
    }
  }

  async function reset(){
    if(!email.trim()){
      setError("Digite seu e-mail primeiro.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try{
      await sendPasswordReset(email.trim(),returnUrl);
      setMessage(isInvite
        ?"Enviamos as instruções de recuperação para o seu e-mail. Este convite continuará no link de retorno."
        :"Enviamos as instruções de recuperação para o seu e-mail.");
    }catch(err){
      setError(err instanceof Error?err.message:"Não foi possível enviar o e-mail.");
    }finally{
      setBusy(false);
    }
  }

  return <main className="center-page">
    <section className="auth-card">
      <div className="brand-mark">🐾</div>
      <p className="eyebrow">Rotina Pet</p>
      <h1>{isInvite?"Só falta identificar você":mode==="login"?"Entrar":"Criar conta"}</h1>
      <p className="muted">{isInvite
        ?mode==="login"
          ?"Entre com o e-mail que recebeu o convite para concluir o vínculo."
          :"Crie sua conta com o e-mail que recebeu o convite para concluir o vínculo."
        :"Acompanhe alimentação e peso de cada animal."}</p>
      {isInvite&&<p className="invite-auth-note">Você já aceitou o convite. Ele fica preservado enquanto identificamos sua conta.</p>}
      <form onSubmit={submit} className="stack-form">
        <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
        <label>Senha<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="login"?"current-password":"new-password"}/></label>
        {error&&<p className="error-box">{error}</p>}
        {message&&<p className="success-box">{message}</p>}
        <button className="primary-button" disabled={busy}>{busy?"Aguarde…":mode==="login"?"Entrar":"Criar conta"}</button>
      </form>
      <div className="auth-actions">
        <button className="link-button" onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");setMessage("");}}>{mode==="login"?"Ainda não tenho conta":"Já tenho conta"}</button>
        {mode==="login"&&<button className="link-button" onClick={()=>void reset()} disabled={busy}>Esqueci a senha</button>}
      </div>
    </section>
  </main>;
}
