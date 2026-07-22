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
  return new Date(`${v.slice(0,10)}T12:00:00Z`).toLocaleDateString("pt-BR",{timeZone:"UTC"});
}

export function detectTimeZone(){
  try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"America/Sao_Paulo";}catch{return"America/Sao_Paulo";}
}

export function todayInTimeZone(timeZone:string){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
  }).formatToParts(new Date());
  const year=parts.find(part=>part.type==="year")?.value;
  const month=parts.find(part=>part.type==="month")?.value;
  const day=parts.find(part=>part.type==="day")?.value;
  return year&&month&&day?`${year}-${month}-${day}`:new Date().toISOString().slice(0,10);
}

export function todayLocal(){
  return todayInTimeZone(detectTimeZone());
}

export function shiftLocalDate(date:string,days:number){
  const value=new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}

export function formatLocalDateLong(date:string){
  const value=new Date(`${date}T12:00:00Z`);
  const label=new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(value);
  return label.charAt(0).toUpperCase()+label.slice(1);
}

export function isBeforeToday(date:string,timeZone=detectTimeZone()){
  return date<todayInTimeZone(timeZone);
}

export function timePt(iso:string,timeZone?:string){
  return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",...(timeZone?{timeZone}:{})});
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
