export type AppIconName = "today" | "weight" | "foods" | "plan" | "pets";

export function AppIcon({name}:{name:AppIconName}){
  const common={width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};

  if(name==="today")return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if(name==="weight")return <svg {...common}><path d="M5 19h14"/><path d="M7 19V9.5a5 5 0 0 1 10 0V19"/><path d="M12 9.5 15 7"/><circle cx="12" cy="9.5" r=".8" fill="currentColor" stroke="none"/></svg>;
  if(name==="foods")return <svg {...common}><path d="M4.5 11.5h15a7.5 7.5 0 0 1-15 0Z"/><path d="M7 8.5c1.2-2.3 2.5-3.4 4-3.4 1.8 0 2.8 1.4 4.8 1.4"/></svg>;
  if(name==="plan")return <svg {...common}><rect x="5.5" y="4.5" width="13" height="15" rx="2"/><path d="M9 3.5h6v3H9z"/><path d="M9 11h6M9 15h4"/></svg>;
  return <svg {...common}><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="5.8" cy="13" r="1.7"/><circle cx="18.2" cy="13" r="1.7"/><path d="M12 11.5c-3.1 0-5.2 2.4-5.2 4.6 0 1.8 1.4 3 3.1 3 .9 0 1.4-.4 2.1-.4s1.2.4 2.1.4c1.7 0 3.1-1.2 3.1-3 0-2.2-2.1-4.6-5.2-4.6Z"/></svg>;
}
