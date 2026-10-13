"use client";
import { useState,Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound, ShieldCheck } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button, Notice } from "@/components/ui/primitives";
import type { Patient } from "@/types";
import { normalizeDigits } from "@/lib/utils";
import { LiveAuthForm } from "./live-auth-form";
export const validPhone=(phone:string)=>/^01[0125][0-9]{8}$/.test(normalizeDigits(phone));
export function AuthForm(props:{initial?:"login"|"register"|"otp"|"forgot";onSuccess?:(patient:Patient)=>void}) {
  const {integration,t}=useApp();
  if(!integration)return <div className="auth-form" role="status">{t("loading")}</div>;
  return integration?.mode==="demo"?<Suspense><LiveAuthForm {...props}/></Suspense>:<OfflineAuthForm {...props}/>;
}
function OfflineAuthForm({initial="login",onSuccess}:{initial?:"login"|"register"|"otp"|"forgot";onSuccess?:(patient:Patient)=>void}) {
  const {t,patch,notify}=useApp(),router=useRouter();
  const [mode,setMode]=useState(initial),[name,setName]=useState(""),[phone,setPhone]=useState(""),[password,setPassword]=useState(""),[code,setCode]=useState(""),[error,setError]=useState(""),[recovered,setRecovered]=useState(false);
  const complete=(patient:Patient)=>{patch({user:patient});if(onSuccess)onSuccess(patient);else router.replace("/account");};
  const submit=(e:React.FormEvent)=>{
    e.preventDefault();setError("");
    if(mode==="otp"){if(!/^\d{6}$/.test(code)){setError(t("otp"));return;}complete({name:name.trim()||t("demoPatient"),phone:normalizeDigits(phone)||"01012345678"});return;}
    if(mode==="register"&&name.trim().length<2){setError(t("nameError"));return;}
    if(!validPhone(phone)){setError(t("phoneError"));return;}
    if(mode==="forgot"){setRecovered(true);setPassword("");return;}
    if(password.length<6){setError(t("passwordError"));return;}
    setPassword("");setMode("otp");
  };
  const heading=mode==="login"?"loginTitle":mode==="register"?"registerTitle":mode==="otp"?"otpTitle":"forgotTitle";
  return <div className="auth-form"><span className="auth-mark"><UserRound size={28}/></span><h1>{t(heading)}</h1><p className="muted">{t(mode==="forgot"?"forgotSub":"loginSub")}</p><Notice>{t("authNotice")}</Notice>
    {recovered?<div className="auth-success"><ShieldCheck size={33}/><p role="status">{t("forgotDone")}</p><Button onClick={()=>{setMode("login");setRecovered(false);}}>{t("login")}</Button></div>:<form onSubmit={submit} noValidate>
      {mode==="register"&&<label>{t("patientName")}<input name="demo-name" autoComplete="off" value={name} onChange={e=>setName(e.target.value)} placeholder={t("namePlaceholder")} maxLength={80}/></label>}
      {mode!=="otp"&&<label>{t("phone")}<input name="demo-phone" type="tel" inputMode="tel" dir="ltr" autoComplete="off" value={phone} onChange={e=>setPhone(e.target.value)} placeholder={t("phonePlaceholder")} maxLength={11}/></label>}
      {(mode==="login"||mode==="register")&&<label>{t("password")}<input name="demo-password" type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} maxLength={40}/></label>}
      {mode==="otp"&&<><label>{t("otp")}<input className="otp-input" name="demo-otp" inputMode="numeric" dir="ltr" autoComplete="off" value={code} onChange={e=>setCode(normalizeDigits(e.target.value).replace(/\D/g,"").slice(0,6))} placeholder="123456" maxLength={6}/></label><p className="small muted">{t("otpHint")}</p><button type="button" className="text-link" onClick={()=>notify("otpHint")}>{t("resend")}</button></>}
      {error&&<p className="field-error" role="alert">{error}</p>}<Button type="submit" className="full-width">{t(mode==="otp"?"verify":mode==="forgot"?"next":"sendCode")}<ArrowLeft size={17} className="directional"/></Button>
    </form>}
    {mode==="login"&&<button type="button" className="text-link auth-forgot" onClick={()=>{setMode("forgot");setError("");}}>{t("forgot")}</button>}
    {(mode==="login"||mode==="register")&&<><div className="auth-divider"><span>{t("demo")}</span></div><Button variant="dark" className="full-width" onClick={()=>complete({name:t("demoPatient"),phone:"01012345678"})}>{t("demoSignIn")}</Button><p className="auth-switch">{t(mode==="login"?"noAccount":"hasAccount")} <button type="button" className="text-link" onClick={()=>{setMode(mode==="login"?"register":"login");setError("");}}>{t(mode==="login"?"register":"login")}</button></p></>}
    {(mode==="otp"||mode==="forgot")&&<button type="button" className="text-link" onClick={()=>{setMode("login");setError("");}}>{t("back")}</button>}
    {!onSuccess&&<Link href="/" className="text-link">{t("returnHome")}</Link>}
  </div>;
}
