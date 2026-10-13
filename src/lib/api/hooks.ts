"use client";
import { useEffect,useState } from "react";
import { useApp } from "@/lib/app-context";
import { api } from "./client";
import type { Doctor } from "@/types";
export function useDoctor(id:string){
  const {doctors,integration,cacheDoctors}=useApp(),[failedId,setFailedId]=useState(""),[fetched,setFetched]=useState<{requestedId:string;doctor:Doctor}|null>(null);
  const cached=doctors.find(d=>d.id===id||d.slug===id);
  useEffect(()=>{
    if(integration?.mode!=="demo")return;
    const controller=new AbortController();
    api.doctor(id,controller.signal).then(doctor=>{if(!controller.signal.aborted){setFetched({requestedId:id,doctor});cacheDoctors([doctor]);}}).catch(()=>{if(!controller.signal.aborted)setFailedId(id);});
    return()=>controller.abort();
  },[id,integration?.mode,cacheDoctors]);
  const result=fetched?.requestedId===id?fetched.doctor:undefined,error=failedId===id;
  return {doctor:result||cached,error,loading:integration?.mode==="demo"&&!result&&!error};
}
