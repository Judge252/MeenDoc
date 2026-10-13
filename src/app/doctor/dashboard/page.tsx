"use client";
import { useState } from "react";
import { LiveDoctorDashboard } from "@/components/management/live-doctor";
import { X, Plus, CalendarDays } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Portrait } from "@/components/doctors/doctor-card";
import { DoctorEditor } from "@/components/doctors/doctor-editor";
import { Button, Notice, PageHeading } from "@/components/ui/primitives";
import { formatTime } from "@/lib/mock-service";
export default function DoctorDashboard(){
  const {t,l,lang,doctors,applications,appointments,patch,notify,integration,ready}=useApp();
  const [selected,setSelected]=useState("doctor-1"),[newTime,setNewTime]=useState(""),[section,setSection]=useState<"profile"|"availability"|"appointments">("profile");
  const doctor=doctors.find(d=>d.id===selected)!,application=applications[applications.length-1];
  const updateSlots=(slots:string[])=>{patch({doctors:doctors.map(d=>d.id===doctor.id?{...d,slots}:d)});notify("slotAdded");};
  const addSlot=()=>{if(!/^(0\d|1\d|2[0-3]):[0-5]\d$/.test(newTime)||doctor.slots.includes(newTime)){notify("invalidTime");return;}updateSlots([...doctor.slots,newTime].sort());setNewTime("");};
  if(integration?.mode==="demo")return <LiveDoctorDashboard/>;
  if(!ready||!doctor)return <div className="container"><h1>{t("loading")}</h1></div>;
  return <div className="container dashboard-page"><PageHeading title={t("doctorDashboard")} description={t("adminNotice")} eyebrow={t("demo")}/><label className="admin-filter">{t("doctorName")}<select value={selected} onChange={e=>setSelected(e.target.value)}>{doctors.map(d=><option key={d.id} value={d.id}>{l(d.name)}</option>)}</select></label><div className="tabs" role="tablist" aria-label={t("doctorDashboard")}>{([{key:"profile",label:"doctorEdit"},{key:"availability",label:"availability"},{key:"appointments",label:"appointments"}] as const).map(({key,label})=><button type="button" role="tab" key={key} className={section===key?"selected":""} aria-selected={section===key} onClick={()=>setSection(key)}>{t(label)}</button>)}</div><div className="doctor-dashboard-layout"><section className="doctor-dashboard-card"><div className="booking-doctor-summary"><Portrait doctor={doctor}/><div><span className="demo-tag">{t("demoProfile")}</span><h3>{l(doctor.name)}</h3><p>{t(doctor.specialty)}</p></div></div>
    {section==="profile"&&<DoctorEditor key={doctor.id} doctor={doctor}/>}
    {section==="availability"&&<><h2>{t("availability")}</h2><div className="slot-editor">{doctor.slots.map(time=><span key={time}>{formatTime(time,lang)}<button type="button" aria-label={t("remove")+" "+formatTime(time,lang)} onClick={()=>doctor.slots.length>1?updateSlots(doctor.slots.filter(s=>s!==time)):notify("minSlot")}><X size={14}/></button></span>)}</div><div className="add-slot"><label>{t("time")}<input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)}/></label><Button variant="dark" onClick={addSlot}><Plus size={16}/>{t("addSlot")}</Button></div><label style={{marginTop:25}}>{t("dayOffset")}<input type="number" min={1} max={7} value={doctor.dayOffset} onChange={e=>{const value=Number(e.target.value);if(value>=1&&value<=7)patch({doctors:doctors.map(d=>d.id===doctor.id?{...d,dayOffset:value}:d)});}}/></label><Notice>{t("bookingSub")}</Notice></>}
    {section==="appointments"&&<><h2>{t("appointments")}</h2>{appointments.filter(a=>a.doctorId===doctor.id).length?appointments.filter(a=>a.doctorId===doctor.id).map(a=><div className="summary-row" key={a.id}><CalendarDays size={20}/><div><span dir="ltr">{a.id}</span><p>{a.date} · {formatTime(a.time,lang)}</p></div><span className={"status-pill "+a.status}>{t(a.status)}</span></div>):<Notice>{t("noAppointments")}</Notice>}</>}
    </section><aside className="doctor-dashboard-card"><h2>{t("applicationStatus")}</h2><p>{application?.name}</p><span className={"status-pill "+(application?.status||"pending")} style={{marginTop:13}}>{t(application?.status||"pending")}</span><Notice>{t("credentialsNote")}</Notice><div className="metrics" style={{gridTemplateColumns:"1fr",marginTop:25,marginBottom:0}}><div className="metric"><span>{t("appointments")}</span><strong>{new Intl.NumberFormat(lang).format(appointments.filter(a=>a.doctorId===doctor.id).length)}</strong></div></div></aside></div></div>;
}
