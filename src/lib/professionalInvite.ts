const INVITE_KIND="professional";

function appBaseUrl(){
  const url=new URL(import.meta.env.BASE_URL,window.location.href);
  url.search="";
  url.hash="";
  return url;
}


export function hasProfessionalInvitationInUrl(){
  const params=new URLSearchParams(window.location.search);
  return params.get("invite")===INVITE_KIND;
}

export function readProfessionalInvitationToken(){
  const params=new URLSearchParams(window.location.search);
  if(params.get("invite")!==INVITE_KIND)return null;
  const token=params.get("token")?.trim()??"";
  return token||null;
}

export function readProfessionalInvitationIntent(){
  const params=new URLSearchParams(window.location.search);
  return params.get("invite")===INVITE_KIND&&params.get("intent")==="accept";
}

export function buildProfessionalInvitationUrl(token:string,acceptedIntent=false){
  const url=appBaseUrl();
  url.searchParams.set("invite",INVITE_KIND);
  url.searchParams.set("token",token.trim());
  if(acceptedIntent)url.searchParams.set("intent","accept");
  return url.toString();
}

export function setProfessionalInvitationIntentInUrl(acceptedIntent:boolean){
  const url=new URL(window.location.href);
  if(acceptedIntent)url.searchParams.set("intent","accept");
  else url.searchParams.delete("intent");
  window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`);
}

export function clearProfessionalInvitationFromUrl(){
  const url=new URL(window.location.href);
  url.searchParams.delete("invite");
  url.searchParams.delete("token");
  url.searchParams.delete("intent");
  window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`);
}
