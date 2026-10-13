"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Keyboard, AudioLines } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Modal, Button, Notice } from "@/components/ui/primitives";
type VoiceState="idle"|"checking"|"listening"|"processing"|"preview"|"unsupported"|"error";
interface LocalRecognition {
  processLocally:boolean; lang:string; continuous:boolean; interimResults:boolean;
  onstart:(()=>void)|null; onerror:(()=>void)|null; onend:(()=>void)|null;
  onresult:((event:{results:{length:number;[index:number]:{isFinal:boolean;[index:number]:{transcript:string}}}})=>void)|null;
  start:()=>void;stop:()=>void;abort:()=>void;
}
interface LocalRecognitionConstructor {
  new():LocalRecognition;
  available?:(options:{langs:string[];processLocally:boolean})=>Promise<string>;
}
type SpeechWindow=Window & {SpeechRecognition?:LocalRecognitionConstructor;webkitSpeechRecognition?:LocalRecognitionConstructor};
export function VoiceControl({open,onClose,onText}:{open:boolean;onClose:()=>void;onText:(text:string)=>void}) {
  const {t,lang}=useApp();const [status,setStatus]=useState<VoiceState>("idle"),[transcript,setTranscript]=useState("");
  const ref=useRef<LocalRecognition|null>(null),cancelled=useRef(false),hasTranscript=useRef(false);
  useEffect(()=>()=>{cancelled.current=true;ref.current?.abort();},[]);
  const close=()=>{cancelled.current=true;ref.current?.abort();ref.current=null;setStatus("idle");setTranscript("");onClose();};
  const start=async()=>{
    setStatus("checking");setTranscript("");cancelled.current=false;hasTranscript.current=false;
    const Speech=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
    if(!Speech?.available){setStatus("unsupported");return;}
    try{
      const recognition=new Speech();
      if(!("processLocally" in recognition)){setStatus("unsupported");return;}
      const language=lang==="ar"?"ar-EG":"en-US";
      const availability=await Speech.available({langs:[language],processLocally:true});
      if(cancelled.current)return;
      if(availability!=="available"){setStatus("unsupported");return;}
      recognition.processLocally=true;recognition.lang=language;recognition.continuous=false;recognition.interimResults=false;
      recognition.onstart=()=>{if(!cancelled.current)setStatus("listening");};
      recognition.onerror=()=>{if(!cancelled.current)setStatus("error");};
      recognition.onresult=event=>{
        if(cancelled.current)return;
        let text="";
        for(let i=0;i<event.results.length;i++)if(event.results[i].isFinal)text+=event.results[i][0].transcript;
        if(text.trim()){hasTranscript.current=true;setTranscript(text.slice(0,1000));setStatus("preview");}
      };
      recognition.onend=()=>{if(!cancelled.current&&!hasTranscript.current)setStatus("error");};
      ref.current=recognition;recognition.start();
    }catch{if(!cancelled.current)setStatus("error");}
  };
  return <Modal open={open} onClose={close} title={t("speak")}><div className="voice-panel">
    <Notice>{t("voicePrivacy")}</Notice>
    <div className={"voice-orb "+(status==="listening"?"listening":"")}><Mic size={36}/></div>
    {status==="listening"&&<div className="waveform" aria-hidden="true">{[1,2,3,4,5,6,7].map(n=><i key={n} style={{animationDelay:n*90+"ms"}}/>)}</div>}
    <p role="status" aria-live="polite">{t(status==="idle"?"orType":status==="checking"?"voiceChecking":status==="listening"?"voiceListening":status==="processing"?"voiceProcessing":status==="unsupported"?"voiceUnsupported":status==="preview"?"voicePreview":"voiceError")}</p>
    {status==="idle"&&<Button onClick={start}><Mic size={17}/>{t("voicePermission")}</Button>}
    {status==="listening"&&<Button variant="dark" onClick={()=>{setStatus("processing");ref.current?.stop();}}><Square size={16}/>{t("stop")}</Button>}
    {status==="error"&&<Button onClick={start}><RotateCcw size={16}/>{t("retry")}</Button>}
    {status==="preview"&&<><label className="sr-only" htmlFor="voice-transcript">{t("voicePreview")}</label><textarea id="voice-transcript" value={transcript} onChange={e=>setTranscript(e.target.value)} maxLength={1000}/><Button disabled={!transcript.trim()} onClick={()=>{onText(transcript);close();}}>{t("useText")}</Button></>}
    {(status==="unsupported"||status==="error"||status==="idle")&&<div className="demo-phrases"><span className="muted">{t("demoPhrase")}</span>{(["starterSpecialty","starterNear"] as const).map(key=><button type="button" className="chip" key={key} onClick={()=>{onText(t(key));close();}}><AudioLines size={16}/>{t(key)}</button>)}</div>}
    <Button variant="ghost" onClick={close}><Keyboard size={16}/>{t("useText")}</Button>
  </div></Modal>;
}
