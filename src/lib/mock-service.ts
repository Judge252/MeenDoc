import type { Doctor, Preferences, Language } from "@/types";
import { copy } from "@/lib/i18n";
export const emptyPreferences: Preferences = {specialty:"all",governorate:"all",area:"all",maxFee:2000,gender:"all",timing:"all",subspecialty:"all",maxDays:30};
export function filterDoctors(doctors: Doctor[], preferences: Preferences, search="") {
  const query=search.trim().toLocaleLowerCase();
  return doctors.filter(d=> d.active &&
    (preferences.specialty==="all" || d.specialty===preferences.specialty) &&
    (preferences.subspecialty==="all" || d.specialty===preferences.subspecialty) &&
    d.dayOffset<=preferences.maxDays &&
    (preferences.governorate==="all" || d.governorate===preferences.governorate) &&
    (preferences.area==="all" || d.area===preferences.area) &&
    d.fee<=preferences.maxFee &&
    (preferences.gender==="all" || d.gender===preferences.gender) &&
    (preferences.timing==="all" || d.slots.some(slot => preferences.timing==="morning"?Number(slot.split(":")[0])<12:Number(slot.split(":")[0])>=12)) &&
    (!query || [d.name.ar,d.name.en,...copy[d.specialty as keyof typeof copy]].some(s=>s.toLocaleLowerCase().includes(query)))
  ).sort((a,b)=>a.dayOffset-b.dayOffset || a.fee-b.fee);
}
export function demoDates(offset=1) {
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=(type:string)=>parts.find(p=>p.type===type)?.value ?? "01";
  const base=new Date(part("year")+"-"+part("month")+"-"+part("day")+"T12:00:00Z");
  return Array.from({length:7},(_,i)=>{const d=new Date(base);d.setUTCDate(d.getUTCDate()+offset+i);return d.toISOString().slice(0,10);});
}
export function formatDate(date:string, language:Language, options:Intl.DateTimeFormatOptions={month:"short",day:"numeric"}) {
  return new Intl.DateTimeFormat(language==="ar"?"ar-EG":"en-EG",{...options,timeZone:"Africa/Cairo"}).format(new Date(date+"T12:00:00Z"));
}
export function formatTime(time:string,language:Language) {
  return new Intl.DateTimeFormat(language==="ar"?"ar-EG":"en-EG",{hour:"numeric",minute:"2-digit",timeZone:"UTC"}).format(new Date("2026-01-01T"+time+":00Z"));
}
