"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, MapPin, CalendarDays, Clock, ShieldCheck, CircleCheck } from "lucide-react";
import { useApp } from "@/lib/app-context";
import type { CopyKey } from "@/lib/i18n";
import type { Appointment,Doctor } from "@/types";
import { formatDate, formatTime } from "@/lib/mock-service";
import { Portrait } from "@/components/doctors/doctor-card";
import { Button, Modal, Notice, EmptyState, PageHeading,Skeleton } from "@/components/ui/primitives";
import { CalendarPicker, TimeSlotSelector,doctorDates } from "./slot-picker";
import { api } from "@/lib/api/client";
import { useDoctor } from "@/lib/api/hooks";
import { AuthForm, validPhone } from "@/components/auth/auth-form";
import { normalizeDigits } from "@/lib/utils";
const stepKeys=["clinicStep","dateStep","timeStep","authStep","detailsStep","reviewStep"] as const;
export function BookingFlow({id,initialDate,initialTime,initialClinicId}:{id:string;initialDate?:string;initialTime?:string;initialClinicId?:string}) {
  const {t,ready}=useApp(),{doctor,loading,error}=useDoctor(id);
  if(loading||!ready)return <div className="container"><h1>{t("loading")}</h1><Skeleton count={1}/></div>;
  if(!doctor||!doctor.active||error)return <div className="container"><EmptyState title={t("unavailable")} description={t("noResultsSub")} action={t("seeAll")}/></div>;
  return <BookingDetails key={doctor.id} doctor={doctor} initialDate={initialDate} initialTime={initialTime} initialClinicId={initialClinicId}/>;
}
function BookingDetails({doctor,initialDate,initialTime,initialClinicId}:{doctor:Doctor;initialDate?:string;initialTime?:string;initialClinicId?:string}){
  const {t,l,money,lang,user,patch,appointments,notify,integration,refreshData}=useApp();
  const id=doctor.id,firstClinicId=doctor.clinics?.find(c=>c.id===initialClinicId)?.id||doctor.clinics?.[0]?.id||"";
  const [clinicId,setClinicId]=useState(firstClinicId),[bookingBusy,setBookingBusy]=useState(false),[idempotencyKey]=useState(()=>crypto.randomUUID());
  const dates=doctorDates(doctor,clinicId||undefined);
  const [step,setStep]=useState(0),[clinic,setClinic]=useState<"main"|"second">("main");
  const [date,setDate]=useState(dates.includes(initialDate||"")?initialDate!:dates[0]||"");
  const [time,setTime]=useState(()=>doctor.availableSlots?doctor.availableSlots.some(s=>s.clinicId===firstClinicId&&s.date===initialDate&&s.time===initialTime)?initialTime!:"":doctor.slots.includes(initialTime||"")?initialTime!:"");
  const [name,setName]=useState(user?.name||""),[phone,setPhone]=useState(user?.phone||""),[error,setError]=useState("");
  const [authOpen,setAuthOpen]=useState(false),[confirmed,setConfirmed]=useState<Appointment|null>(null);
  const bookingFee=confirmed?.feeSnapshot??doctor.clinics?.find(c=>c.id===clinicId)?.fee??doctor.fee;
  const selectedClinic=doctor.clinics?.find(c=>c.id===clinicId);
  const taken=appointments.some(a=>a.status==="confirmed"&&a.doctorId===id&&a.date===date&&a.time===time);
  const next=()=>{
    setError("");
    if(step===0&&integration?.mode==="demo"&&!selectedClinic){setError(t("noAvailability"));return;}
    if(step===1&&!dates.includes(date)){setError(t("chooseDate"));return;}
    if(step===2&&(!time||taken)){setError(t(taken?"slotTaken":"chooseTime"));return;}
    if(step===3&&!user){setAuthOpen(true);return;}
    if(step===4){if(name.trim().length<2){setError(t("nameError"));return;}if(!validPhone(phone)){setError(t("phoneError"));return;}}
    setStep(Math.min(step+1,5));
  };
  const confirm=async()=>{
    if(!user){setStep(3);return;}
    if(taken){notify("slotTaken");setStep(2);setTime("");return;}
    if(!dates.includes(date)||!doctor.slots.includes(time)){setStep(1);return;}
    if(integration?.mode==="demo"){
      const selected=doctor.availableSlots?.find(s=>s.date===date&&s.time===time&&s.clinicId===clinicId);
      if(!selected){setError(t("slotTaken"));return;}
      setBookingBusy(true);
      try{const appointment=await api.book(selected.id,idempotencyKey,{name:name.trim(),phone:normalizeDigits(phone)});setConfirmed(appointment);await refreshData();}catch{setError(t("slotTaken"));}finally{setBookingBusy(false);}
      return;
    }
    const appointment:Appointment={id:"MD-"+crypto.randomUUID().slice(0,8).toUpperCase(),doctorId:id,date,time,clinic,patient:{name:name.trim(),phone:normalizeDigits(phone)},status:"confirmed"};
    patch({appointments:[...appointments,appointment]});setConfirmed(appointment);
  };
  const summary=<><div className="booking-doctor-summary"><Portrait doctor={doctor}/><div><span className="demo-tag">{t("demoProfile")}</span><h3>{l(doctor.name)}</h3><p>{t(doctor.specialty)}</p></div></div><div className="summary-row"><MapPin size={18}/><span>{selectedClinic?l(selectedClinic.address):t(doctor.area as CopyKey)+"، "+t(doctor.governorate)}<small>{selectedClinic?l(selectedClinic.name):t(clinic==="main"?"mainClinic":"secondClinic")}</small></span></div><div className="summary-row"><CalendarDays size={18}/><span>{date?formatDate(date,lang,{dateStyle:"full"}):t("noAvailability")}</span></div>{time&&<div className="summary-row"><Clock size={18}/><span>{formatTime(time,lang)}</span></div>}<div className="price-total"><span>{t("total")}</span><strong>{money(bookingFee)}</strong></div><p className="small muted">{t("noPayment")}</p></>;
  if(confirmed)return <div className="container confirmation-page"><span className="confirmation-icon"><CircleCheck size={47}/></span><span className="demo-tag">{t("demoBooking")}</span><h1>{t("bookedTitle")}</h1><p>{t("bookedSub")}</p><div className="confirmation-summary">{summary}<div className="reference"><span>{t("reference")}</span><strong dir="ltr">{confirmed.id}</strong></div></div><div className="button-row"><Link className="btn btn-primary" href="/appointments">{t("viewAppointments")}</Link><Link className="btn btn-outline" href="/">{t("returnHome")}</Link></div></div>;
  return <div className="container booking-page"><Link href={"/doctors/"+id} className="text-link"><ArrowRight size={16} className="directional"/>{t("back")}</Link><PageHeading title={t("bookingTitle")} description={t("bookingSub")}/><ol className="booking-stepper">{stepKeys.map((key,i)=><li key={key} className={i===step?"current":i<step?"done":""}><span>{i<step?<Check size={14}/>:new Intl.NumberFormat(lang).format(i+1)}</span><strong>{t(key)}</strong></li>)}</ol>
    <div className="booking-layout"><section className="booking-main"><div className="step-label">{new Intl.NumberFormat(lang).format(step+1)} / {new Intl.NumberFormat(lang).format(6)}</div><h2>{t(stepKeys[step])}</h2>
      {step===0&&integration?.mode==="demo"&&<div className="clinic-options">{doctor.clinics?.map(c=><button type="button" key={c.id} className={clinicId===c.id?"selected":""} aria-pressed={clinicId===c.id} onClick={()=>{setClinicId(c.id);setDate(doctorDates(doctor,c.id)[0]||"");setTime("");}}><MapPin size={24}/><div><strong>{l(c.name)}</strong><p>{l(c.address)} · {money(c.fee)}</p></div></button>)}</div>}{step===0&&integration?.mode!=="demo"&&<div className="clinic-options">{(["main","second"] as const).map(c=><button type="button" key={c} className={clinic===c?"selected":""} aria-pressed={clinic===c} onClick={()=>setClinic(c)}><MapPin size={24}/><div><strong>{t(c==="main"?"mainClinic":"secondClinic")}</strong><p>{t(doctor.area as CopyKey)}، {t(doctor.governorate)}</p></div><span className="radio-dot"/></button>)}</div>}
      {step===1&&<CalendarPicker doctor={doctor} clinicId={clinicId||undefined} value={date} onChange={d=>{setDate(d);setTime("");}}/>}
      {step===2&&<TimeSlotSelector doctor={doctor} clinicId={clinicId||undefined} date={date} value={time} onChange={setTime}/>}
      {step===3&&<div className="booking-auth"><ShieldCheck size={39}/><h3>{t("bookingGate")}</h3><p>{t("bookingGateSub")}</p>{user?<Notice>{t("confirmed")} · {user.name}</Notice>:<Button onClick={()=>setAuthOpen(true)}>{t("login")}</Button>}</div>}
      {step===4&&<div className="patient-fields"><Notice>{t("fictionalDetails")}</Notice><label>{t("patientName")}<input name="patient-name" value={name} onChange={e=>setName(e.target.value)} placeholder={t("namePlaceholder")} autoComplete="off" maxLength={80}/></label><label>{t("phone")}<input name="patient-phone" type="tel" dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)} placeholder={t("phonePlaceholder")} autoComplete="off" maxLength={11}/></label></div>}
      {step===5&&<div className="booking-review"><h3>{t("reviewTitle")}</h3><dl><div><dt>{t("patientName")}</dt><dd>{name}</dd></div><div><dt>{t("phone")}</dt><dd dir="ltr">{phone}</dd></div><div><dt>{t("date")}</dt><dd>{formatDate(date,lang,{dateStyle:"full"})}</dd></div><div><dt>{t("time")}</dt><dd>{formatTime(time,lang)}</dd></div><div><dt>{t("price")}</dt><dd>{money(bookingFee)}</dd></div></dl><Notice>{t("bookedSub")}</Notice></div>}
      {error&&<p className="field-error" role="alert">{error}</p>}
      <div className="booking-controls"><Button variant="ghost" disabled={step===0} onClick={()=>{setError("");setStep(step-1);}}><ArrowRight size={16} className="directional"/>{t("back")}</Button>{step===5?<Button disabled={bookingBusy} onClick={confirm}>{t("confirmBooking")}<Check size={18}/></Button>:<Button disabled={step===2&&!time} onClick={next}>{t("next")}<ArrowLeft size={16} className="directional"/></Button>}</div>
    </section><aside className="booking-summary">{summary}</aside></div>
    <Modal open={authOpen} onClose={()=>setAuthOpen(false)} title={t("login")}><AuthForm onSuccess={patient=>{setName(patient.name);setPhone(patient.phone);setAuthOpen(false);setStep(4);}}/></Modal>
  </div>;
}
