"use client";
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { areaKeys, areaGovernorate, specialtyKeys } from "@/lib/i18n";
import type { Doctor } from "@/types";
import { Button, Notice } from "@/components/ui/primitives";
import { doctors as referenceDoctors } from "@/data/doctors";
export function DoctorEditor({doctor,onSave}:{doctor:Doctor;onSave?:()=>void}){
  const {t,saveDoctor,notify,integration,user,specialties}=useApp();const [draft,setDraft]=useState(doctor),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const categories=integration?.mode==="demo"?specialties.filter(s=>s.active).map(s=>s.slug):specialtyKeys;
  const provider=integration?.mode==="demo"&&!user?.roles?.includes("admin");
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(draft.name.ar.trim().length<2||draft.name.en.trim().length<2){setError(t("nameError"));return;}
    if(draft.fee<100||draft.fee>5000||!Number.isFinite(draft.fee)){setError(t("validFee"));return;}
    const reference=integration?.mode==="offline"?referenceDoctors.find(d=>d.specialty===draft.specialty):undefined;
    const updated=reference?{...draft,subspecialty:reference.subspecialty,services:reference.services}:draft;
    setBusy(true);try{await saveDoctor(updated);notify("saved");onSave?.();}catch{setError(t("mutationFailed"));}finally{setBusy(false);}
  };
  return <form className="editor-form" onSubmit={save} noValidate><Notice>{t("credentialsNote")}</Notice><div className="settings-grid"><label>{t("nameArabic")}<input dir="rtl" value={draft.name.ar} onChange={e=>setDraft({...draft,name:{...draft.name,ar:e.target.value}})} maxLength={80}/></label><label>{t("nameEnglish")}<input dir="ltr" value={draft.name.en} onChange={e=>setDraft({...draft,name:{...draft.name,en:e.target.value}})} maxLength={80}/></label><label>{t("specialty")}<select disabled={provider} value={draft.specialty} onChange={e=>setDraft({...draft,specialty:e.target.value as Doctor["specialty"]})}>{categories.map(s=><option value={s} key={s}>{t(s)}</option>)}</select></label><label>{t("fee")}<input type="number" min={100} max={5000} value={draft.fee} onChange={e=>setDraft({...draft,fee:Number(e.target.value)})}/></label><label>{t("governorate")}<select disabled={provider} value={draft.governorate} onChange={e=>{const gov=e.target.value as Doctor["governorate"];setDraft({...draft,governorate:gov,area:areaKeys.find(a=>areaGovernorate[a]===gov)!});}}>{(["cairo","giza","alexandria"] as const).map(g=><option value={g} key={g}>{t(g)}</option>)}</select></label><label>{t("area")}<select disabled={provider} value={draft.area} onChange={e=>setDraft({...draft,area:e.target.value})}>{areaKeys.filter(a=>areaGovernorate[a]===draft.governorate).map(a=><option value={a} key={a}>{t(a)}</option>)}</select></label></div>{integration?.mode==="demo"&&<><div className="settings-grid"><label>{t("aboutDoctor")} · {t("arabic")}<textarea value={draft.bio.ar} onChange={e=>setDraft({...draft,bio:{...draft.bio,ar:e.target.value}})} maxLength={1500}/></label><label>{t("aboutDoctor")} · {t("english")}<textarea value={draft.bio.en} onChange={e=>setDraft({...draft,bio:{...draft.bio,en:e.target.value}})} maxLength={1500}/></label>{(["credentials","experience"] as const).map(key=><div key={key}><label>{t(key)} · {t("arabic")}<input value={draft[key]?.[0]?.ar||""} onChange={e=>setDraft({...draft,[key]:[{ar:e.target.value,en:draft[key]?.[0]?.en||""}]})} maxLength={1500}/></label><label>{t(key)} · {t("english")}<input value={draft[key]?.[0]?.en||""} onChange={e=>setDraft({...draft,[key]:[{ar:draft[key]?.[0]?.ar||"",en:e.target.value}]})} maxLength={1500}/></label></div>)}</div>{!provider&&<label>{t("gender")}<select value={draft.gender} onChange={e=>setDraft({...draft,gender:e.target.value as Doctor["gender"]})}><option value="female">{t("female")}</option><option value="male">{t("male")}</option></select></label>}</>}{error&&<p className="field-error" role="alert">{error}</p>}<Button type="submit" disabled={busy} variant="dark">{t("save")}</Button></form>;
}
