"use client";
import { useApp } from "@/lib/app-context";
import { formatDate, formatTime, demoDates } from "@/lib/mock-service";
import type { Doctor } from "@/types";
export function doctorDates(doctor:Doctor,clinicId?:string){return doctor.availableSlots?[...new Set(doctor.availableSlots.filter(s=>!clinicId||s.clinicId===clinicId).map(s=>s.date))]:demoDates(doctor.dayOffset);}
export function CalendarPicker({doctor,value,onChange,clinicId}:{doctor:Doctor;value:string;onChange:(date:string)=>void;clinicId?:string}) {
  const {t,lang}=useApp(),dates=doctorDates(doctor,clinicId);
  return <fieldset className="calendar-picker"><legend>{t("chooseDate")}</legend><div className="date-buttons">{dates.map(d=><button type="button" key={d} className={value===d?"selected":""} aria-pressed={value===d} aria-label={formatDate(d,lang,{dateStyle:"full"})} onClick={()=>onChange(d)}><span>{formatDate(d,lang,{weekday:"short"})}</span><strong>{formatDate(d,lang,{day:"numeric"})}</strong><small>{formatDate(d,lang,{month:"short"})}</small></button>)}</div></fieldset>;
}
export function TimeSlotSelector({doctor,date,value,onChange,excludeId,clinicId}:{doctor:Doctor;date:string;value:string;onChange:(time:string)=>void;excludeId?:string;clinicId?:string}) {
  const {t,lang,appointments}=useApp();
  const times=doctor.availableSlots?[...new Set(doctor.availableSlots.filter(s=>s.date===date&&(!clinicId||s.clinicId===clinicId)).map(s=>s.time))]:doctor.slots;
  return <fieldset className="time-picker"><legend>{t("chooseTime")}</legend>{!times.length&&<p>{t("noAvailability")}</p>}<div className="time-slots">{times.map(time=>{
    const taken=appointments.some(a=>a.id!==excludeId&&a.status==="confirmed"&&a.doctorId===doctor.id&&a.date===date&&a.time===time);
    return <button type="button" key={time} className={value===time?"selected":""} disabled={taken} title={taken?t("slotTaken"):undefined} aria-pressed={value===time} onClick={()=>onChange(time)}>{formatTime(time,lang)}</button>;
  })}</div></fieldset>;
}
