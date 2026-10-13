"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { Heart, MapPin, ArrowLeft, ChevronLeft, ChevronRight, Check, Scale } from "lucide-react";
import { useApp } from "@/lib/app-context";
import type { Doctor } from "@/types";
import type { CopyKey } from "@/lib/i18n";
import { demoDates, formatDate } from "@/lib/mock-service";
import { Modal, Button } from "@/components/ui/primitives";
export function Portrait({doctor,className=""}:{doctor:Doctor;className?:string}) {
  const {l,t}=useApp();
  return <div role="img" aria-label={l(doctor.name)+" · "+t("fictionalPortrait")} className={"portrait "+className} style={{backgroundImage:"url('/images/fictional-doctors.png')",backgroundSize:"400% 400%",backgroundPosition:(doctor.portrait%4)*100/3+"% "+Math.floor(doctor.portrait/4)*100/3+"%"}}/>;
}
export function FavoriteButton({doctor}:{doctor:Doctor}) {
  const {t,l,favorites,toggleFavorite}=useApp();const saved=favorites.includes(doctor.id);
  return <button type="button" className={"favorite-button "+(saved?"saved":"")} aria-label={t(saved?"favoriteRemove":"favoriteAdd")+" "+l(doctor.name)} aria-pressed={saved} onClick={()=>toggleFavorite(doctor.id)}><Heart size={21} fill={saved?"currentColor":"none"}/></button>;
}
export function DoctorCard({doctor,compare=false,matched=false}:{doctor:Doctor;compare?:boolean;matched?:boolean}) {
  const {t,l,money,lang,comparison,toggleCompare}=useApp(),selected=comparison.includes(doctor.id),nextDate=doctor.availableSlots?doctor.availableSlots[0]?.date:demoDates(doctor.dayOffset)[0];
  return <article className="doctor-card" data-doctor-id={doctor.id}><div className="doctor-photo"><Link href={"/doctors/"+doctor.id+(matched?"?from=assistant":"")} tabIndex={-1} aria-hidden="true"><Portrait doctor={doctor}/></Link><span className="photo-badge">{t("demoProfile")}</span><FavoriteButton doctor={doctor}/></div>
    <div className="doctor-card-info"><Link href={"/doctors/"+doctor.id+(matched?"?from=assistant":"")} className="doctor-name">{l(doctor.name)}</Link><p>{t(doctor.specialty)}<span className="metadata-dot">·</span>{l(doctor.subspecialty)}</p><p className="location-line"><MapPin size={13}/>{t(doctor.area as CopyKey)}، {t(doctor.governorate)}</p><p className="doctor-price"><strong>{money(doctor.fee)}</strong><span>/ {t("consultation")}</span></p><p className="availability-line">{t("nextSlot")} · {nextDate?formatDate(nextDate,lang):t("noAvailability")}</p>
    {compare&&<button type="button" className={"compare-toggle "+(selected?"selected":"")} aria-pressed={selected} onClick={()=>toggleCompare(doctor.id)}>{selected?<Check size={15}/>:<Scale size={15}/>} {t(selected?"comparing":"compare")}</button>}</div>
  </article>;
}
export function DoctorCarousel() {
  const {t,doctors,lang}=useApp(),ref=useRef<HTMLDivElement>(null);
  const scroll=(forward:boolean)=>ref.current?.scrollBy({left:(forward?1:-1)*(lang==="ar"?-1:1)*320,behavior:"smooth"});
  return <section className="doctor-section"><div className="section-heading"><div><h2>{t("suggestedDoctors")}</h2><p>{t("suggestedDoctorsSub")}</p></div><div className="section-tools"><Link href="/doctors" className="text-link">{t("seeAll")}<ArrowLeft size={16} className="directional"/></Link><div className="carousel-controls"><button type="button" className="icon-btn" aria-label={t("back")} onClick={()=>scroll(false)}><ChevronRight size={18} className="directional"/></button><button type="button" className="icon-btn" aria-label={t("next")} onClick={()=>scroll(true)}><ChevronLeft size={18} className="directional"/></button></div></div></div>
    <div className="doctor-carousel" ref={ref}>{doctors.filter(d=>d.active).slice(0,8).map(d=><DoctorCard key={d.id} doctor={d}/>)}</div>
  </section>;
}
export function CompareBar() {
  const {t,l,money,comparison,doctors,patch,lang}=useApp();const [open,setOpen]=useState(false);
  const items=doctors.filter(d=>comparison.includes(d.id));
  if(!items.length)return null;
  return <><div className="compare-bar"><div className="compare-avatars">{items.map(d=><Portrait doctor={d} key={d.id}/>)}</div><span>{new Intl.NumberFormat(lang).format(items.length)} · {t("compare")}</span><Button variant="dark" disabled={items.length<2} onClick={()=>setOpen(true)}>{t("compare")}</Button><Button variant="ghost" onClick={()=>patch({comparison:[]})}>{t("cancel")}</Button></div>
    <Modal wide open={open} title={t("compareTitle")} onClose={()=>setOpen(false)}><p className="muted">{t("matchingExplanation")}</p><div className="table-scroll"><table className="comparison-table"><thead><tr><th>{t("doctors")}</th>{items.map(d=><th key={d.id}>{l(d.name)}</th>)}</tr></thead><tbody>{(["specialty","location","fee","nextSlot"] as const).map(row=><tr key={row}><th>{t(row)}</th>{items.map(d=><td key={d.id}>{row==="specialty"?t(d.specialty):row==="location"?t(d.area as CopyKey):row==="fee"?money(d.fee):formatDate(demoDates(d.dayOffset)[0],lang)}</td>)}</tr>)}<tr><th>{t("details")}</th>{items.map(d=><td key={d.id}><Link href={"/doctors/"+d.id} onClick={()=>setOpen(false)} className="text-link">{t("details")}</Link></td>)}</tr></tbody></table></div></Modal>
  </>;
}
