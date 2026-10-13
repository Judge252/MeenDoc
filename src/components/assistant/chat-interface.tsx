"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, Mic, Send, RotateCcw, Keyboard, Stethoscope, MapPin, Wallet, Search, ArrowLeft, LockKeyhole, Check, Volume2, CircleAlert, ShieldCheck } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { transition, newConversation, type Scenario } from "@/lib/conversation-engine";
import { type CopyKey } from "@/lib/i18n";
import { filterDoctors } from "@/lib/mock-service";
import { PreferenceFields } from "@/components/doctors/preferences-form";
import { DoctorCard, CompareBar } from "@/components/doctors/doctor-card";
import { Button, EmptyState, Notice,Modal } from "@/components/ui/primitives";
import { request } from "@/lib/api/client";
import type { Doctor,Preferences } from "@/types";
import { VoiceControl } from "./voice-control";
export function ChatInterface() {
  const {t,lang,conversation,patch,doctors,announcement,notify,location,integration,cacheDoctors}=useApp();
  const [input,setInput]=useState(""),[voice,setVoice]=useState(false),[busy,setBusy]=useState(false);
  const [preferences,setPreferences]=useState(conversation.preferences);
  const [consent,setConsent]=useState(false),[adult,setAdult]=useState(false),[consentOpen,setConsentOpen]=useState(false),[pendingAction,setPendingAction]=useState<Parameters<typeof transition>[1]|null>(null),[source,setSource]=useState<"live"|"scripted"|"unavailable">("scripted"),[liveMatches,setLiveMatches]=useState<Doctor[]>([]);
  const transcriptRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLInputElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),activeRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);activeRequest.current?.abort();window.speechSynthesis?.cancel();},[]);
  useEffect(()=>{const el=transcriptRef.current;if(el)el.scrollTo({top:el.scrollHeight,behavior:"smooth"});},[conversation.messages.length,busy]);
  const live=async(action:Parameters<typeof transition>[1],approved=consent)=>{
    const useGemini=action.type==="start"||action.type==="free"||action.type==="answer";
    if(useGemini&&!approved){setPendingAction(action);setConsentOpen(true);return;}
    const message=action.type==="free"?action.text:action.type==="start"||action.type==="answer"?t(action.key):"";
    setBusy(true);
    const controller=new AbortController();activeRequest.current=controller;
    try{
      const result=await request<{reply:string;mode:"live"|"scripted";phase:typeof conversation.phase;preferences:Preferences;doctors:Doctor[]}>("/api/assistant/message","POST",{
        message,language:lang,action:action.type==="preferences"?"preferences":action.type==="scenario"?"scenario":"message",
        ...(action.type==="preferences"?{preferences:action.preferences}:{}),...(action.type==="scenario"?{scenario:action.scenario}:{}),
        history:conversation.messages.slice(-12).map(m=>({role:m.role,text:m.key?t(m.key):m.raw||""})),
        ...(approved?{consent:{adult:true,fictional:true,google:true,version:"meendoc-ai-v1"}}:{}),
      },controller.signal);
      if(controller.signal.aborted)return;
      // This timestamp is created after the user's awaited request, outside render.
      // eslint-disable-next-line react-hooks/purity
      const now=Date.now(),messages=[...conversation.messages,...(message?[{id:conversation.messages.length,role:"user" as const,raw:message,at:now}]:[]),{id:conversation.messages.length+1,role:"assistant" as const,raw:result.reply,at:now}];
      patch({matchDoctorIds:result.doctors.map(d=>d.id),conversation:{...conversation,phase:result.phase,preferences:result.preferences,specialty:result.preferences.specialty,messages}});
      setPreferences(result.preferences);setSource(result.mode);setLiveMatches(result.doctors);cacheDoctors(result.doctors);
    }catch{if(!controller.signal.aborted){setSource("unavailable");notify("aiUnavailable");}}finally{if(!controller.signal.aborted)setBusy(false);}
  };
  const act=(action:Parameters<typeof transition>[1])=>{
    if(busy||!integration)return;
    if(integration?.mode==="demo"){
      if(action.type==="change"){patch({conversation:{...conversation,phase:"preferences"}});return;}
      void live(action);return;
    }
    const next=transition(conversation,action);
    if(next.phase==="preferences"&&conversation.phase!=="results"&&next.preferences.governorate==="all")next.preferences={...next.preferences,governorate:location};
    setBusy(true);
    timer.current=setTimeout(()=>{patch({conversation:next});setPreferences(next.preferences);setBusy(false);},450);
  };
  const restart=async()=>{
    if(busy)return;
    if(timer.current)clearTimeout(timer.current);
    setBusy(true);
    try{if(integration?.mode==="demo")await request("/api/assistant/message","POST",{language:lang,action:"restart",history:[]});const fresh=newConversation();patch({conversation:fresh,matchDoctorIds:[]});setPreferences(fresh.preferences);setInput("");setLiveMatches([]);setSource("scripted");}catch{setSource("unavailable");notify("aiUnavailable");}finally{setBusy(false);}
  };
  const submit=(event:React.FormEvent)=>{
    event.preventDefault();if(!input.trim()||busy||conversation.phase==="emergency")return;
    const matchingKey=(["starterSpecialty","starterNear","starterBudget","starterBrowse"] as const).find(k=>t(k)===input.trim());
    act(matchingKey?{type:"start",key:matchingKey}:{type:"free",text:input.trim()});setInput("");
  };
  const playback=(text:string)=>{
    if(!("speechSynthesis" in window)){notify("playbackUnavailable");return;}
    const voice=window.speechSynthesis.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith(lang==="ar"?"ar":"en"));
    if(!voice){notify("playbackUnavailable");return;}
    window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.voice=voice;speech.lang=voice.lang;speech.rate=.95;window.speechSynthesis.speak(speech);
  };
  const phase=conversation.phase,matches=integration?.mode==="demo"?liveMatches:filterDoctors(doctors,conversation.preferences);
  const scenarios: [Scenario,CopyKey][]=[["eyes","scenarioEyes"],["skin","scenarioSkin"],["joint","scenarioJoint"],["unknown","scenarioUnknown"],["emergency","scenarioEmergency"]];
  const stages=[{key:"stepUnderstand",sub:"stepUnderstandSub"},{key:"stepGuide",sub:"stepGuideSub"},{key:"stepMatch",sub:"stepMatchSub"}] as const;
  const progress=phase==="intro"||phase==="choose"?0:phase==="duration"||phase==="impact"||phase==="uncertain"||phase==="emergency"?1:2;
  return <div className="assistant-layout" id="assistant"><section className={"chat-panel "+(phase!=="intro"?"chat-started":"")} aria-label={t("assistant")}>
    <div className="chat-toolbar"><div className="assistant-identity"><span className="small-ai-mark"><AudioLines size={20}/></span><div><strong>{t("assistant")}</strong><span className="online-status"><i/>{t(integration?.mode==="demo"?source==="live"?"liveAi":source==="unavailable"?"aiUnavailable":"scriptedMode":"ready")}</span></div><span className="demo-tag">{t("demo")}</span></div><div className="chat-tools"><div className="mode-toggle"><button type="button" className="selected" aria-label={t("text")} onClick={()=>inputRef.current?.focus()}><Keyboard size={16}/><span>{t("text")}</span></button><button type="button" aria-label={t("voice")} onClick={()=>setVoice(true)}><Mic size={16}/><span>{t("voice")}</span></button></div><button type="button" className="icon-btn" aria-label={t("restart")} disabled={busy} onClick={restart}><RotateCcw size={17}/></button></div></div>
    {announcement&&<div className="announcement">{announcement}</div>}
    <div className="chat-transcript" ref={transcriptRef} role="log" aria-live="polite" aria-label={t("assistant")}>
      <div className="chat-message assistant-message"><span className="message-avatar"><AudioLines size={19}/></span><div className="message-body"><p>{t("chatIntro")}</p><span className="message-meta">{t("assistantName")}</span></div></div>
      {conversation.messages.map(m=><div className={"chat-message "+(m.role==="user"?"user-message":"assistant-message")} key={m.id}>{m.role==="assistant"&&<span className="message-avatar"><AudioLines size={18}/></span>}<div className="message-body"><p>{m.key?t(m.key):m.raw}</p><div className="message-meta"><time>{new Intl.DateTimeFormat(lang==="ar"?"ar-EG":"en-EG",{hour:"numeric",minute:"2-digit",timeZone:"Africa/Cairo"}).format(m.at)}</time>{m.role==="assistant"&&<button type="button" aria-label={t("playback")} onClick={()=>playback(m.key?t(m.key):m.raw??"")}><Volume2 size={13}/></button>}</div></div></div>)}
      {busy&&<div className="typing-indicator" role="status" aria-label={t("loading")}><i/><i/><i/></div>}
    </div>
    <div className="chat-interactions" aria-busy={busy}>
      {integration?.mode==="demo"&&phase!=="emergency"&&<button type="button" className="text-link" disabled={busy} onClick={()=>{setSource("scripted");patch({conversation:{...conversation,phase:"choose"}});}}>{t("scriptedMode")}</button>}
      {phase==="intro"&&<><div className="starter-grid">{([{key:"starterSpecialty",icon:Stethoscope},{key:"starterNear",icon:MapPin},{key:"starterBudget",icon:Wallet},{key:"starterBrowse",icon:Search}] as const).map(({key,icon:Icon})=><button type="button" className="starter" key={key} disabled={busy||!integration} onClick={()=>act({type:"start",key})}><Icon size={19}/><span>{t(key)}</span><ArrowLeft size={16} className="directional"/></button>)}</div><div className="voice-invitation"><button type="button" className="mic-button" aria-label={t("speak")} onClick={()=>setVoice(true)}><Mic size={25}/></button><div><strong>{t("speak")}</strong><span>{t("orType")}</span></div></div></>}
      {(phase==="choose"||phase==="uncertain")&&<><div className="quick-replies">{scenarios.map(([scenario,key])=><button type="button" disabled={busy||!integration} className={"chip "+(scenario==="emergency"?"warning-chip":"")} key={scenario} onClick={()=>act({type:"scenario",scenario})}>{t(key)}</button>)}</div>{phase==="uncertain"&&<Notice warning>{t("uncertainTitle")}</Notice>}</>}
      {(phase==="duration"||phase==="impact")&&<div className="quick-replies">{(phase==="duration"?["days","weeks","unsure"]:["routine","urgent"]).map(key=><button type="button" className="chip" disabled={busy||!integration} key={key} onClick={()=>act({type:"answer",key:key as CopyKey})}>{t(key as CopyKey)}</button>)}</div>}
      {phase==="preferences"&&<div className="chat-preferences">{conversation.specialty!=="all"&&<div className="specialty-recommendation"><span><Stethoscope size={22}/></span><div><small>{t("recommendation")}</small><h3>{t(conversation.specialty)}</h3></div><span className="demo-tag">{t("demo")}</span></div>}<h3>{t("preferencesTitle")}</h3><PreferenceFields value={preferences} onChange={setPreferences} compact/><Button disabled={busy||!integration} onClick={()=>act({type:"preferences",preferences})}>{t("showMatches")}<ArrowLeft size={16} className="directional"/></Button></div>}
      {phase==="results"&&<div className="chat-results"><div className="section-heading"><h3>{t("matchesTitle")}</h3><button type="button" className="text-link" onClick={()=>act({type:"change"})}>{t("changePrefs")}</button></div><p className="small muted">{t("matchingExplanation")}</p>{matches.length?<div className="doctor-grid compact-grid">{matches.slice(0,6).map(d=><DoctorCard doctor={d} key={d.id} compare matched/>)}</div>:<EmptyState title={t("noResults")} description={t("noResultsSub")}/>}<CompareBar/></div>}
      {phase==="emergency"&&<div className="emergency-panel" role="alert"><CircleAlert size={27}/><h3>{t("emergencyTitle")}</h3><p>{t("emergencyStopped")}</p><Button variant="outline" onClick={restart}>{t("restart")}</Button></div>}
    </div>
    <form className={"composer "+(phase==="emergency"?"composer-disabled":"")} onSubmit={submit}><button type="button" className="icon-btn composer-mic" aria-label={t("speak")} disabled={phase==="emergency"} onClick={()=>setVoice(true)}><Mic size={20}/></button><label className="sr-only" htmlFor="message-input">{t("composer")}</label><input id="message-input" ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder={t("composer")} autoComplete="off" maxLength={1000} disabled={phase==="emergency"}/><button type="submit" className="send-button" aria-label={t("send")} disabled={!integration||!input.trim()||busy||phase==="emergency"}><Send size={19} className="directional"/></button></form>
    <p className="chat-safety"><ShieldCheck size={13}/>{t("safetyShort")}</p>
    <VoiceControl open={voice} onClose={()=>setVoice(false)} onText={text=>{setInput(text);requestAnimationFrame(()=>inputRef.current?.focus());}}/>
    <Modal open={consentOpen} onClose={()=>setConsentOpen(false)} title={t("aiConsentTitle")}><Notice>{t("aiConsent")}</Notice><label className="setting-switch">{t("adultConsent")}<input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/></label><div className="modal-actions"><Button variant="ghost" onClick={()=>setConsentOpen(false)}>{t("cancel")}</Button><Button disabled={!adult} onClick={()=>{setConsent(true);setConsentOpen(false);if(pendingAction)void live(pendingAction,true);}}>{t("aiConsentAccept")}</Button></div></Modal>
  </section>
  <aside className="journey-aside"><span className="aside-caption">{t("guestNotice")}</span><h2>{t("stepsTitle")}</h2><ol className="journey-steps">{stages.map(({key,sub},i)=><li key={key} className={i===progress?"current":i<progress?"done":""}><span className="step-number">{i<progress?<Check size={15}/>:new Intl.NumberFormat(lang).format(i+1)}</span><div><strong>{t(key)}</strong><p>{t(sub)}</p></div></li>)}</ol><div className="aside-privacy"><LockKeyhole size={19}/><p>{t("privacyPill")}</p></div><Link href="/doctors" className="browse-link">{t("browseYourself")}<ArrowLeft size={17} className="directional"/></Link></aside>
  </div>;
}
