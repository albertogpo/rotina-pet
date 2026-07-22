import type {FoodUnit} from "../types";

export const unitLabels:Record<FoodUnit,string>={
  g:"g",
  ml:"ml",
  sachet:"sachê",
  can:"lata",
  scoop:"medida",
  unit:"unidade",
};

export function numberPt(v:number,d=3){
  return v.toLocaleString("pt-BR",{maximumFractionDigits:d});
}

export function datePt(v:string){
  return new Date(`${v.slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR");
}

export function todayLocal(){
  const n=new Date();
  const y=n.getFullYear();
  const m=String(n.getMonth()+1).padStart(2,"0");
  const d=String(n.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

export function shiftLocalDate(date:string,days:number){
  const value=new Date(`${date}T12:00:00`);
  value.setDate(value.getDate()+days);
  const y=value.getFullYear();
  const m=String(value.getMonth()+1).padStart(2,"0");
  const d=String(value.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

export function formatLocalDateLong(date:string){
  const value=new Date(`${date}T12:00:00`);
  const label=new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long"}).format(value);
  return label.charAt(0).toUpperCase()+label.slice(1);
}

export function isBeforeToday(date:string){
  return date<todayLocal();
}

export function toLocalScheduledIso(date:string,time:string){
  return new Date(`${date}T${time.slice(0,5)}:00`).toISOString();
}

export function timePt(iso:string){
  return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}

export function generateEvenTimes(start:string,end:string,count:number){
  if(count<=1)return[start];
  const[sh,sm]=start.split(":").map(Number);
  const[eh,em]=end.split(":").map(Number);
  const a=sh*60+sm;
  const b=eh*60+em;
  if(b<=a)throw new Error("O último horário precisa ser posterior ao primeiro.");
  const gap=(b-a)/(count-1);
  return Array.from({length:count},(_,i)=>{
    const total=Math.round(a+gap*i);
    return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  });
}
