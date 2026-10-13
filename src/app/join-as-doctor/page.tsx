"use client";
import { useState } from "react";
import Link from "next/link";
import { Stethoscope, MessagesSquare, SlidersHorizontal, CircleCheck } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { specialtyKeys } from "@/lib/i18n";
import type { DoctorApplication } from "@/types";
import { Button, PageHeading, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/api/client";
export default function JoinPage(){
  const {t,lang,applications,patch,integration,specialties,ready}=useApp(),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[adult,setAdult]=useState(false);
  const categories=integration?.mode==="demo"?specialties.filter(s=>s.active).map(s=>s.slug):specialtyKeys;
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const data=new FormData(e.currentTarget);
    const application:DoctorApplication={id:"APP-"+crypto.randomUUID().slice(0,8).toUpperCase(),name:String(data.get("name")).trim(),specialty:String(data.get("specialty")) as DoctorApplication["specialty"],governorate:String(data.get("gov")) as DoctorApplication["governorate"],area:String(data.get("area")).trim(),registration:String(data.get("registration")).trim(),clinic:String(data.get("clinic")).trim(),contact:String(data.get("contact")).trim(),status:"pending"};
    if(integration?.mode==="demo"){
      if(!adult){setError(t("consentRequired"));return;}setBusy(true);setError("");
      try{await api.apply({...application,id:undefined,status:undefined,adultConsent:true,demoConsent:true});setDone(true);}catch{setError(t("mutationFailed"));}finally{setBusy(false);}return;
    }
    patch({applications:[...applications,application]});setDone(true);
  };
  const benefits=[{title:"benefit1",sub:"benefit1Sub",icon:Stethoscope},{title:"benefit2",sub:"benefit2Sub",icon:MessagesSquare},{title:"benefit3",sub:"benefit3Sub",icon:SlidersHorizontal}] as const;
  if(!ready||!integration)return <div className="container"><h1>{t("loading")}</h1></div>;
  return <div className="container join-page"><PageHeading title={t("partnershipTitle")} description={t("partnershipSub")} eyebrow={t("partnershipEyebrow")}/><div className="join-layout"><div><section className="founding-program"><h2>{t("founding")}</h2><h3>{t("offer")}</h3><p>{t("offerNote")}</p></section><h2>{t("whyJoin")}</h2><div className="benefits">{benefits.map(({title,sub,icon:Icon})=><div key={title} className="benefit"><Icon size={23}/><div><h3>{t(title)}</h3><p>{t(sub)}</p></div></div>)}</div><h2>{t("onboarding")}</h2><ol className="onboarding-list">{(["interest","reviewApplication","publishProfile"] as const).map((key,i)=><li key={key}><span>{new Intl.NumberFormat(lang).format(i+1)}</span>{t(key)}</li>)}</ol><h2>{t("faq")}</h2><div className="faq-list">{(["faq1","faq2","faq3"] as const).map((key,i)=><details key={key}><summary>{t(key)}</summary><p>{t((["faq1a","faq2a","faq3a"] as const)[i])}</p></details>)}</div></div>
    <form className="application-form" onSubmit={submit}><h2>{t("applicationTitle")}</h2><Notice>{t(integration?.mode==="demo"?"applicationBackendNotice":"applicationNotice")}</Notice>{done?<div className="application-success"><CircleCheck size={42}/><p role="status">{t(integration?.mode==="demo"?"applicationReceived":"applicationDone")}</p><span className="status-pill pending">{t("pending")}</span><Link href="/doctor/dashboard" className="btn btn-dark">{t("doctorDashboard")}</Link><Button variant="ghost" onClick={()=>setDone(false)}>{t("interest")}</Button></div>:<>
      <label>{t("doctorName")}<input required name="name" minLength={2} maxLength={80} autoComplete="off" placeholder={t("namePlaceholder")}/></label><label>{t("specialty")}<select name="specialty" required>{categories.map(s=><option value={s} key={s}>{t(s)}</option>)}</select></label><div className="settings-grid"><label>{t("governorate")}<select name="gov">{(["cairo","giza","alexandria"] as const).map(g=><option key={g} value={g}>{t(g)}</option>)}</select></label><label>{t("area")}<input required name="area" maxLength={60} autoComplete="off"/></label></div><label>{t("registration")}<input required name="registration" maxLength={100} autoComplete="off" placeholder="DEMO-ONLY"/></label><label>{t("clinicInfo")}<textarea required name="clinic" maxLength={250} autoComplete="off"/></label><label>{t("contact")}<input required name="contact" maxLength={100} autoComplete="off" placeholder="example@example.test"/></label>{integration?.mode==="demo"&&<label className="setting-switch">{t("adultConsent")}<input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/></label>}{error&&<p className="field-error" role="alert">{error}</p>}<Button disabled={busy} type="submit">{t("submitInterest")}</Button></>}</form>
  </div></div>;
}
