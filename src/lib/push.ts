declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal:any)=>void>;
  }
}

const ONESIGNAL_APP_ID=import.meta.env.VITE_ONESIGNAL_APP_ID?.trim();
const SDK_URL="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
const APP_BASE_PATH=(()=>{
  const pathname=new URL(import.meta.env.BASE_URL,window.location.href).pathname;
  return pathname.endsWith("/")?pathname:`${pathname}/`;
})();
const WORKER_DIRECTORY=`${APP_BASE_PATH}push/onesignal/`;
const WORKER_PATH=`${WORKER_DIRECTORY.replace(/^\//,"")}OneSignalSDKWorker.js`;

let scriptPromise:Promise<void>|null=null;
let initPromise:Promise<any>|null=null;

function loadSdk(){
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
    if(document.querySelector(`script[src="${SDK_URL}"]`)){resolve();return;}
    const script=document.createElement("script");
    script.src=SDK_URL;
    script.defer=true;
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error("Não foi possível carregar o SDK de notificações."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function hasPushConfig(){
  return Boolean(ONESIGNAL_APP_ID);
}

export async function initPush(userId?:string){
  if(!hasPushConfig())return null;
  await loadSdk();
  if(!initPromise){
    initPromise=new Promise((resolve,reject)=>{
      window.OneSignalDeferred=window.OneSignalDeferred||[];
      window.OneSignalDeferred.push(async(OneSignal:any)=>{
        try{
          await OneSignal.init({
            appId:ONESIGNAL_APP_ID,
            serviceWorkerPath:WORKER_PATH,
            serviceWorkerParam:{scope:WORKER_DIRECTORY},
            allowLocalhostAsSecureOrigin:location.hostname==="localhost",
            notifyButton:{enable:false},
            welcomeNotification:{
              title:"Rotina Pet",
              message:"Tudo certo: as notificações estão ativas. Enviaremos lembretes nos horários das refeições.",
            },
          });
          resolve(OneSignal);
        }catch(error){
          reject(error instanceof Error?error:new Error("Falha ao inicializar o OneSignal."));
        }
      });
    });
  }
  const OneSignal=await initPromise;
  if(userId)await OneSignal.login(userId);
  return OneSignal;
}

export async function logoutPush(){
  if(!hasPushConfig())return;
  const OneSignal=await initPush();
  if(OneSignal)await OneSignal.logout();
}

export async function getPushStatus(userId?:string){
  const supported="Notification" in window;
  const permission=supported?Notification.permission:"denied";
  if(!hasPushConfig())return {configured:false,supported,permission,subscribed:false};
  const OneSignal=await initPush(userId);
  let subscribed=false;
  try{subscribed=Boolean(OneSignal?.User?.PushSubscription?.optedIn);}catch{}
  return {configured:true,supported,permission,subscribed};
}

export async function setPushSubscription(enabled:boolean,userId?:string){
  const OneSignal=await initPush(userId);
  if(!OneSignal)return {configured:false};
  if(userId)await OneSignal.login(userId);

  if(enabled){
    if("Notification" in window&&Notification.permission==="denied")return getPushStatus(userId);
    if("Notification" in window&&Notification.permission==="default")await OneSignal.Notifications.requestPermission();
    if("Notification" in window&&Notification.permission==="granted")await OneSignal.User.PushSubscription.optIn();
  }else{
    await OneSignal.User.PushSubscription.optOut();
  }
  return getPushStatus(userId);
}

export async function requestPushPermission(userId?:string){
  return setPushSubscription(true,userId);
}
