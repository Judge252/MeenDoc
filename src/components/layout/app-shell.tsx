"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { AudioLines, Globe2, UserRound, Menu, Home, Stethoscope, Heart, ArrowUpRight, CalendarDays, Check } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Modal } from "@/components/ui/primitives";
import type { CopyKey } from "@/lib/i18n";
export function Logo() {
  return <Link href="/" className="logo" aria-label="MEENDOC"><span className="logo-symbol"><AudioLines size={25} strokeWidth={2.1}/></span><span dir="ltr">meendoc<span className="logo-dot">.</span></span></Link>;
}
export function Header() {
  const {t,lang,setLanguage,user}=useApp();const path=usePathname();const [menu,setMenu]=useState(false);
  const links=[{href:"/",key:"home",icon:AudioLines},{href:"/doctors",key:"doctors",icon:Stethoscope},{href:"/appointments",key:"appointments",icon:CalendarDays}] as const;
  return <header className="app-header"><div className="header-inner"><Logo/>
    <nav className="desktop-nav" aria-label={t("menu")}>{links.map(({href,key,icon:Icon})=><Link href={href} className={(path===href?"active":"")} key={key}><Icon size={18}/>{t(key)}</Link>)}</nav>
    <div className="header-actions"><Link href="/join-as-doctor" className="join-link">{t("join")}</Link>
      <button className="language-btn" type="button" aria-label={t("language")} onClick={()=>setLanguage(lang==="ar"?"en":"ar")}><Globe2 size={18}/><span>{lang==="ar"?"EN":"العربية"}</span></button>
      <Link href={user?"/account":"/login"} className="profile-button"><UserRound size={18}/><span>{t(user?"account":"login")}</span></Link>
      <button type="button" className="icon-btn mobile-menu" aria-label={t("menu")} onClick={()=>setMenu(true)}><Menu size={22}/></button>
    </div></div>
    <Modal open={menu} onClose={()=>setMenu(false)} title={t("menu")}><nav className="menu-list">{[...links,{href:"/favorites",key:"favorites"},{href:"/account",key:"account"},{href:"/join-as-doctor",key:"join"}].map(({href,key})=><Link href={href} key={key} onClick={()=>setMenu(false)}>{t(key as CopyKey)}</Link>)}</nav></Modal>
  </header>;
}
export function BottomNav() {
  const {t}=useApp(),path=usePathname();
  const items=[{href:"/",key:"home",icon:Home},{href:"/doctors",key:"doctors",icon:Stethoscope},{href:"/#assistant",key:"assistant",icon:AudioLines},{href:"/favorites",key:"favorites",icon:Heart},{href:"/account",key:"account",icon:UserRound}] as const;
  return <nav className="bottom-nav" aria-label={t("menu")}>{items.map(({href,key,icon:Icon})=><Link href={href} key={key} className={(key==="assistant"?"ai-nav ":"")+(path===href?"active":"")}><span><Icon size={21}/></span><span>{t(key)}</span></Link>)}</nav>;
}
export function Footer() {
  const {t,integration,user}=useApp();
  return <footer className="footer"><div className="footer-main"><div><Logo/><p>{t("footerTagline")}</p></div><nav aria-label={t("menu")}><Link href="/doctors">{t("doctors")}</Link><Link href="/join-as-doctor">{t("join")}</Link><Link href="/account#privacy">{t("privacy")}</Link>{(integration?.mode==="offline"||user?.roles?.includes("doctor"))&&<Link href="/doctor/dashboard">{t("doctorDashboard")}</Link>}{(integration?.mode==="offline"||user?.roles?.includes("admin"))&&<Link href="/admin">{t("admin")}</Link>}</nav></div><div className="footer-bottom"><span>{t("footerCopyright")}</span><span className="demo-label">{t("demo")}</span></div></footer>;
}
export function Toast() {
  const {toast}=useApp();
  return <div className={"toast "+(toast?"visible":"")} role="status" aria-live="polite">{toast&&<><Check size={18}/><span>{toast}</span></>}</div>;
}
export function Shell({children}:{children:React.ReactNode}) {
  const {t,l,doctors,integration,dataError}=useApp(),path=usePathname();
  const routeKey:CopyKey=path==="/"?"welcome":path==="/doctors"?"doctors":path.startsWith("/booking/")?"bookingTitle":path==="/appointments"?"appointments":path==="/favorites"?"favorites":path==="/account"?"profileTitle":path==="/join-as-doctor"?"partnershipTitle":path==="/admin"?"admin":path==="/doctor/dashboard"?"doctorDashboard":path==="/register"?"registerTitle":path==="/otp"?"otpTitle":path==="/forgot-password"?"forgotTitle":"loginTitle";
  const doctor=path.startsWith("/doctors/")?doctors.find(d=>d.id===path.split("/")[2]):undefined;
  const title=(doctor?l(doctor.name):t(routeKey))+" | MEENDOC";
  useEffect(()=>{document.title=title;},[title]);
  return <><a href="#main" className="skip-link">{t("skip")}</a><Header/><div className="integration-status" role="status">{t(!integration?"loading":integration.mode==="offline"?"offlineMode":integration.database.ready?"databaseDemo":"integrationUnavailable")}{dataError&&<span> · {t("integrationUnavailable")}</span>}</div><main id="main">{children}</main><Footer/><BottomNav/><Toast/></>;
}
export function PartnershipStrip() {
  const {t}=useApp();
  return <section className="partnership-strip"><div className="partnership-icon"><Stethoscope size={33}/></div><div><h2>{t("partnershipTitle")}</h2><p>{t("partnershipEyebrow")}</p></div><Link href="/join-as-doctor" className="btn btn-outline">{t("partnershipCta")}<ArrowUpRight size={18} className="directional"/></Link></section>;
}
