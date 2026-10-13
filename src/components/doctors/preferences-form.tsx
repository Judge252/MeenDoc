"use client";
import { useId } from "react";
import { useApp } from "@/lib/app-context";
import { areaKeys, areaGovernorate, specialtyKeys } from "@/lib/i18n";
import type { Preferences } from "@/types";
export function PreferenceFields({value,onChange,compact=false}:{value:Preferences;onChange:(value:Preferences)=>void;compact?:boolean}) {
  const {t,money,doctors,l,integration,subspecialties,specialties}=useApp(),id=useId();
  const categories=integration?.mode==="demo"?specialties.filter(s=>s.active).map(s=>s.slug):specialtyKeys;
  const set=<K extends keyof Preferences>(key:K,next:Preferences[K])=>onChange({...value,[key]:next});
  return <div className={"preference-fields "+(compact?"compact":"")}>
    <label htmlFor={id+"specialty"}>{t("specialty")}<select id={id+"specialty"} value={value.specialty} onChange={e=>onChange({...value,specialty:e.target.value as Preferences["specialty"],subspecialty:"all"})}><option value="all">{t("allSpecialties")}</option>{categories.map(s=><option key={s} value={s}>{t(s)}</option>)}</select></label>
    <label htmlFor={id+"gov"}>{t("governorate")}<select id={id+"gov"} value={value.governorate} onChange={e=>onChange({...value,governorate:e.target.value as Preferences["governorate"],area:"all"})}><option value="all">{t("noPreference")}</option>{(["cairo","giza","alexandria"] as const).map(g=><option key={g} value={g}>{t(g)}</option>)}</select></label>
    <label htmlFor={id+"area"}>{t("area")}<select id={id+"area"} value={value.area} onChange={e=>set("area",e.target.value)}><option value="all">{t("noPreference")}</option>{areaKeys.filter(a=>value.governorate==="all"||areaGovernorate[a]===value.governorate).map(a=><option key={a} value={a}>{t(a)}</option>)}</select></label>
    <label htmlFor={id+"budget"}>{t("budget")}<select id={id+"budget"} value={value.maxFee} onChange={e=>set("maxFee",Number(e.target.value))}>{[300,400,500,700,2000].map(f=><option key={f} value={f}>{f===2000?t("noPreference"):money(f)}</option>)}</select></label>
    <label htmlFor={id+"timing"}>{t("timing")}<select id={id+"timing"} value={value.timing} onChange={e=>set("timing",e.target.value as Preferences["timing"])}><option value="all">{t("noPreference")}</option><option value="morning">{t("morning")}</option><option value="evening">{t("evening")}</option></select></label>
    <label htmlFor={id+"gender"}>{t("gender")}<select id={id+"gender"} value={value.gender} onChange={e=>set("gender",e.target.value as Preferences["gender"])}><option value="all">{t("noPreference")}</option><option value="female">{t("female")}</option><option value="male">{t("male")}</option></select></label>
    {!compact&&<><label htmlFor={id+"sub"}>{t("subspecialty")}<select id={id+"sub"} value={value.subspecialty} onChange={e=>set("subspecialty",e.target.value as Preferences["subspecialty"])}><option value="all">{t("noPreference")}</option>{integration?.mode==="demo"?subspecialties.filter(s=>s.active&&(value.specialty==="all"||specialties.find(p=>p.id===s.parentId)?.slug===value.specialty)).map(s=><option key={s.id} value={s.slug}>{l(s.name)}</option>):specialtyKeys.filter(s=>value.specialty==="all"||s===value.specialty).map(s=><option key={s} value={s}>{l(doctors.find(d=>d.specialty===s)!.subspecialty)}</option>)}</select></label><label htmlFor={id+"availability"}>{t("availability")}<select id={id+"availability"} value={value.maxDays} onChange={e=>set("maxDays",Number(e.target.value))}><option value={30}>{t("noPreference")}</option><option value={1}>{t("nextDay")}</option><option value={3}>{t("nextThreeDays")}</option></select></label></>}
  </div>;
}
