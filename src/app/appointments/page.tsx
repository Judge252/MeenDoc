"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { formatDate, formatTime, demoDates } from "@/lib/mock-service";
import type { Appointment } from "@/types";
import type { CopyKey } from "@/lib/i18n";
import { Portrait } from "@/components/doctors/doctor-card";
import { CalendarPicker, TimeSlotSelector } from "@/components/booking/slot-picker";
import { Button, Modal, PageHeading, EmptyState, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/api/client";
export default function AppointmentsPage(){
  const {t,l,lang,money,appointments,doctors,patch,notify,user,integration,refreshData}=useApp();
  const [busy,setBusy]=useState(false);
  const [tab,setTab]=useState<"upcoming"|"previous"|"cancelled">("upcoming"),[cancelId,setCancelId]=useState<string|null>(null),[editing,setEditing]=useState<Appointment|null>(null);
  const [date,setDate]=useState(""),[time,setTime]=useState("");
  const today=demoDates(0)[0];
  const list=appointments.filter(a=>tab==="upcoming"?a.status==="confirmed"&&a.date>=today:tab==="previous"?a.status==="completed"||(a.status==="confirmed"&&a.date<today):a.status==="cancelled");
  const editingDoctor=doctors.find(d=>d.id===editing?.doctorId);
  const reschedule=async()=>{
    if(!editing||!time||!editingDoctor)return;
    if(appointments.some(a=>a.id!==editing.id&&a.doctorId===editing.doctorId&&a.date===date&&a.time===time&&a.status==="confirmed")){notify("slotTaken");return;}
    if(integration?.mode==="demo"){
      const slot=editingDoctor.availableSlots?.find(s=>s.date===date&&s.time===time&&(s.clinicId===editing.clinicId));
      if(!slot||!editing.recordId){notify("slotTaken");return;}setBusy(true);
      try{await api.reschedule(editing.recordId,slot.id);await refreshData();setEditing(null);notify("rescheduled");}catch{notify("mutationFailed");}finally{setBusy(false);}return;
    }
    patch({appointments:appointments.map(a=>a.id===editing.id?{...a,date,time}:a)});setEditing(null);notify("rescheduled");
  };
  const cancel=async()=>{
    const appointment=appointments.find(a=>a.id===cancelId);
    if(integration?.mode==="demo"&&appointment?.recordId){setBusy(true);try{await api.cancel(appointment.recordId);await refreshData();setCancelId(null);notify("appointmentCancelled");}catch{notify("mutationFailed");}finally{setBusy(false);}return;}
    patch({appointments:appointments.map(a=>a.id===cancelId?{...a,status:"cancelled"}:a)});setCancelId(null);notify("appointmentCancelled");
  };
  return <div className="container appointments-page"><PageHeading title={t("appointments")} description={t("bookingSub")}/><div className="tabs" role="tablist" aria-label={t("appointments")}>{(["upcoming","previous","cancelled"] as const).map(key=><button role="tab" type="button" aria-selected={tab===key} key={key} className={tab===key?"selected":""} onClick={()=>setTab(key)}>{t(key)}</button>)}</div>
    {!user&&<Notice>{t("fictionalDetails")}</Notice>}
    {list.length?<div className="appointment-list">{list.map(a=>{const doctor=doctors.find(d=>d.id===a.doctorId);if(!doctor)return null;return <article className="appointment-item" key={a.id}><Portrait doctor={doctor}/><div className="appointment-item-info"><span className={"status-pill "+a.status}>{t(a.status)}</span><Link href={"/doctors/"+doctor.id}><h2>{l(doctor.name)}</h2></Link><p>{t(doctor.specialty)} · {money(a.feeSnapshot??doctor.fee)}</p><p className="location-line"><CalendarDays size={14}/>{formatDate(a.date,lang,{dateStyle:"long"})}<Clock size={14}/>{formatTime(a.time,lang)}</p><p className="location-line"><MapPin size={14}/>{t(doctor.area as CopyKey)}</p><p className="small" dir="ltr">{a.id}</p></div>{a.status==="confirmed"&&a.date>=today&&<div className="button-row"><Button variant="outline" onClick={()=>{setEditing(a);setDate(a.date);setTime(a.time);}}>{t("reschedule")}</Button><Button variant="ghost" onClick={()=>setCancelId(a.id)}>{t("cancelAppointment")}</Button></div>}</article>;})}</div>:<EmptyState title={t("noAppointments")} description={t("noAppointmentsSub")} action={t("seeAll")}/>}
    <Modal open={!!cancelId} onClose={()=>setCancelId(null)} title={t("cancelQuestion")}><p className="muted">{t("cancelExplanation")}</p><div className="modal-actions"><Button variant="ghost" onClick={()=>setCancelId(null)}>{t("back")}</Button><Button variant="dark" disabled={busy} onClick={cancel}>{t("cancelAppointment")}</Button></div></Modal>
    <Modal open={!!editing} onClose={()=>setEditing(null)} title={t("reschedule")}>{editingDoctor&&<><CalendarPicker doctor={editingDoctor} clinicId={editing?.clinicId} value={date} onChange={d=>{setDate(d);setTime("");}}/><TimeSlotSelector doctor={editingDoctor} clinicId={editing?.clinicId} date={date} value={time} onChange={setTime} excludeId={editing?.id}/><Notice>{t("bookingSub")}</Notice><div className="modal-actions"><Button variant="ghost" onClick={()=>setEditing(null)}>{t("back")}</Button><Button disabled={!time||busy} onClick={reschedule}>{t("save")}</Button></div></>}</Modal>
  </div>;
}
