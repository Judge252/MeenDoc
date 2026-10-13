"use client";
import { useState } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api,request } from "@/lib/api/client";
import { normalizeDigits } from "@/lib/utils";
import { Button,Notice } from "@/components/ui/primitives";
import type { Patient } from "@/types";
export function LiveAuthForm({initial="login",onSuccess,reset=false}:{initial?:"login"|"register"|"otp"|"forgot";onSuccess?:(patient:Patient)=>void;reset?:boolean}){
  const {t,refreshData}=useApp(),router=useRouter(),params=useSearchParams();
  const [mode,setMode]=useState(initial),[email,setEmail]=useState(""),[name,setName]=useState(""),[password,setPassword]=useState(""),[code,setCode]=useState(""),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[otpRequested,setOtpRequested]=useState(false);
  const next=params.get("next")||"/account";
  const success=async()=>{await refreshData();const {user}=await api.me();if(onSuccess)onSuccess(user);else router.replace(next.startsWith("/")&&!next.startsWith("//")?next:"/account");};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setError("");setNotice("");
    if(!reset&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setError(t("emailError"));return;}
    if(mode==="register"&&(!consent||name.trim().length<2)){setError(t(!consent?"consentRequired":"nameError"));return;}
    if((reset||mode==="register"||mode==="login")&&password.length<8){setError(t("passwordError"));return;}
    setBusy(true);
    try{
      if(reset){await request("/api/auth/password","POST",{password});setPassword("");setNotice(t("passwordUpdated"));return;}
      if(mode==="forgot"){await request("/api/auth/recovery","POST",{email});setNotice(t("emailSent"));return;}
      if(mode==="otp"){
        if(!otpRequested){await request("/api/auth/email-otp","POST",{email,next});setOtpRequested(true);setNotice(t("emailSent"));return;}
        await request("/api/auth/verify-otp","POST",{email,code,next});await success();return;
      }
      const result=await request<{authenticated:boolean;confirmationRequired:boolean}>("/api/auth/"+mode,"POST",{email,password,...(mode==="register"?{name:name.trim(),adultConsent:consent}:{}),next});
      setPassword("");if(result.authenticated)await success();else setNotice(t("confirmEmail"));
    }catch{setError(t("authFailure"));}finally{setBusy(false);}
  };
  return <div className="auth-form"><span className="auth-mark"><UserRound size={28}/></span><h1>{t(reset?"resetPassword":mode==="login"?"loginTitle":mode==="register"?"registerTitle":mode==="otp"?"otpTitle":"forgotTitle")}</h1><Notice>{t("realAuthNotice")}</Notice><form onSubmit={submit} noValidate>
    {mode==="register"&&!reset&&<label>{t("patientName")}<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoComplete="name"/></label>}
    {!reset&&<label>{t("email")}<input type="email" dir="ltr" value={email} onChange={e=>{setEmail(e.target.value);setOtpRequested(false);}} maxLength={160} autoComplete="email"/></label>}
    {(reset||mode==="login"||mode==="register")&&<label>{t("password")}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={72} autoComplete={reset||mode==="register"?"new-password":"current-password"}/></label>}
    {mode==="otp"&&otpRequested&&<><label>{t("otp")}<input inputMode="numeric" dir="ltr" value={code} onChange={e=>setCode(normalizeDigits(e.target.value).replace(/\D/g,"").slice(0,8))} maxLength={8} autoComplete="one-time-code"/></label><p>{t("realOtpHint")}</p></>}
    {mode==="register"&&<label className="setting-switch">{t("adultConsent")}<input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/></label>}
    {error&&<p className="field-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<Button type="submit" disabled={busy}>{t(busy?"loading":reset?"save":mode==="login"?"login":mode==="register"?"register":mode==="otp"&&otpRequested?"verify":"sendCode")}</Button>
  </form>{!reset&&<div className="button-row">{(["login","register","otp","forgot"] as const).filter(m=>m!==mode).map(m=><button type="button" className="text-link" key={m} onClick={()=>{setMode(m);setError("");setNotice("");setOtpRequested(false);}}>{t(m==="forgot"?"forgot":m==="otp"?"otpTitle":m)}</button>)}</div>}<Link href="/" className="text-link">{t("returnHome")}</Link></div>;
}
