"use client";
import { useState } from "react";
import Link from "next/link";
import { MapPin, Share2, ArrowRight, Stethoscope, GraduationCap, ShieldCheck } from "lucide-react";
import { useApp } from "@/lib/app-context";
import type { CopyKey } from "@/lib/i18n";
import { Portrait, FavoriteButton } from "./doctor-card";
import { CalendarPicker, TimeSlotSelector } from "@/components/booking/slot-picker";
import { filterDoctors, formatDate } from "@/lib/mock-service";
import { EmptyState, Notice,Skeleton } from "@/components/ui/primitives";
import type { Doctor } from "@/types";
import { useDoctor } from "@/lib/api/hooks";
import { doctorDates } from "@/components/booking/slot-picker";
export function DoctorProfile({id,matched}:{id:string;matched:boolean}) {
  const {t,ready}=useApp(),{doctor,loading,error}=useDoctor(id);
  if(loading||!ready)return <div className="container"><h1>{t("loading")}</h1><Skeleton count={1}/></div>;
  if(!doctor||!doctor.active||error)return <div className="container"><EmptyState title={t("unavailable")} description={t("noResultsSub")} action={t("seeAll")}/></div>;
  return <ProfileDetails key={doctor.id} doctor={doctor} matched={matched}/>;
}
function ProfileDetails({doctor,matched}:{doctor:Doctor;matched:boolean}){
  const {t,l,doctors,money,notify,conversation,lang,integration,matchDoctorIds}=useApp();
  const [clinicId,setClinicId]=useState(doctor.clinics?.[0]?.id||"");
  const [date,setDate]=useState(()=>doctorDates(doctor,doctor.clinics?.[0]?.id)[0]||""),[time,setTime]=useState("");
  const clinic=doctor.clinics?.find(c=>c.id===clinicId),fee=clinic?.fee??doctor.fee;
  const booking="/booking/"+doctor.id+"?"+new URLSearchParams({date,...(time?{time}:{}),...(clinicId?{clinicId}:{})});
  const confirmedMatch=matched&&conversation.phase==="results"&&(integration?.mode==="demo"?matchDoctorIds.includes(doctor.id):filterDoctors(doctors,conversation.preferences).some(d=>d.id===doctor.id));
  const share=async()=>{try{await navigator.clipboard.writeText(window.location.href);notify("shared");}catch{notify("shareError");}};
  return <div className="container profile-page"><div className="profile-topbar"><Link className="text-link" href={matched?"/#assistant":"/doctors"}><ArrowRight size={16} className="directional"/>{t(matched?"assistant":"doctors")}</Link><button type="button" className="text-link" onClick={share}><Share2 size={17}/>{t("share")}</button></div>
    <div className="profile-layout"><div className="profile-content"><div className="profile-intro"><div className="profile-photo"><Portrait doctor={doctor}/><span className="photo-badge">{t("demoProfile")}</span><FavoriteButton doctor={doctor}/></div><div className="profile-heading"><span className="eyebrow">{t(doctor.specialty)}</span><h1>{l(doctor.name)}</h1><p>{l(doctor.subspecialty)}</p><div className="location-line"><MapPin size={17}/>{t(doctor.area as CopyKey)}، {t(doctor.governorate)}</div><span className="demo-tag">{t("demoProfile")}</span></div></div>
    {confirmedMatch&&<section className="match-reason"><Stethoscope size={24}/><div><h2>{t("whyMatch")}</h2><p>{t("matchReason")}</p><div className="match-factors"><span>{t(doctor.specialty)}</span><span>{t(doctor.area as CopyKey)}</span><span>{money(doctor.fee)}</span><span>{doctorDates(doctor)[0]?formatDate(doctorDates(doctor)[0],lang):t("noAvailability")}</span></div></div></section>}
    <section className="profile-section"><h2>{t("aboutDoctor")}</h2><p>{l(doctor.bio)}</p></section>
    <section className="profile-section"><h2>{t("services")}</h2><div className="service-list">{doctor.services.map((s,i)=><div key={i}><Stethoscope size={21}/>{l(s)}</div>)}</div></section>
    <section className="profile-section"><h2>{t("credentials")}</h2><div className="credential-row"><GraduationCap size={24}/><div><strong>{t("education")}</strong><p>{doctor.credentials?.length?doctor.credentials.map(c=>l(c)).join(" · "):t("placeholderCredentials")}</p></div></div><div className="credential-row"><ShieldCheck size={24}/><div><strong>{t("experience")}</strong><p>{doctor.experience?.length?doctor.experience.map(c=>l(c)).join(" · "):t("placeholderCredentials")}</p></div></div><p className="small muted">{t("credentialsNote")}</p></section>
    <section className="profile-section"><h2>{t("clinic")}</h2><div className="clinic-location"><MapPin size={27}/><div><strong>{clinic?l(clinic.name):t("mainClinic")}</strong><p>{clinic?l(clinic.address):t(doctor.area as CopyKey)+"، "+t(doctor.governorate)}</p><span className="small muted">{t("demoProfile")}</span></div></div></section></div>
    <aside className="appointment-card"><div className="booking-price"><strong>{money(fee)}</strong><span>/ {t("consultation")}</span></div>{Boolean(doctor.clinics?.length)&&<label>{t("clinic")}<select value={clinicId} onChange={e=>{setClinicId(e.target.value);setDate(doctorDates(doctor,e.target.value)[0]||"");setTime("");}}>{doctor.clinics?.map(c=><option key={c.id} value={c.id}>{l(c.name)} · {money(c.fee)}</option>)}</select></label>}<CalendarPicker doctor={doctor} clinicId={clinicId||undefined} value={date} onChange={d=>{setDate(d);setTime("");}}/><TimeSlotSelector doctor={doctor} clinicId={clinicId||undefined} date={date} value={time} onChange={setTime}/><Link className="btn btn-primary full-width" href={booking}>{t("book")}</Link><p className="small muted text-center">{t("bookingSub")}</p></aside></div>
    <Notice>{t("safetyLong")}</Notice><div className="mobile-booking-bar"><div><strong>{money(fee)}</strong><small>{t("consultation")}</small></div><Link className="btn btn-primary" href={booking}>{t("book")}</Link></div>
  </div>;
}
