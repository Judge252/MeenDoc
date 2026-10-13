"use client";
import { createContext,useContext,useEffect,useReducer,useCallback,type ReactNode } from "react";
import { doctors as fixtures } from "@/data/doctors";
import { copy,translate,localized,type CopyKey } from "@/lib/i18n";
import { newConversation,type Conversation } from "@/lib/conversation-engine";
import { api,request,ClientApiError } from "@/lib/api/client";
import type { Language,Doctor,Appointment,DoctorApplication,Patient,Governorate,Localized,IntegrationStatus,DirectoryItem,Notification } from "@/types";
interface AppState{
  lang:Language;favorites:string[];comparison:string[];doctors:Doctor[];appointments:Appointment[];applications:DoctorApplication[];
  user:Patient|null;conversation:Conversation;location:Governorate|"all";reminders:boolean;toast:string;announcement:string;hydrated:boolean;
  integration:IntegrationStatus|null;ready:boolean;dataError:string;specialties:DirectoryItem[];subspecialties:DirectoryItem[];notifications:Notification[];matchDoctorIds:string[];
}
const initialState:AppState={lang:"ar",favorites:[],comparison:[],doctors:[],appointments:[],applications:[],user:null,conversation:newConversation(),location:"all",reminders:false,toast:"",announcement:"",hydrated:false,integration:null,ready:false,dataError:"",specialties:[],subspecialties:[],notifications:[],matchDoctorIds:[]};
type Action={type:"patch";patch:Partial<AppState>}|{type:"cacheDoctors";doctors:Doctor[]}|{type:"clear"}|{type:"logout"};
function reducer(state:AppState,action:Action):AppState{
  if(action.type==="clear")return {...state,favorites:[],comparison:[],user:null,appointments:[],conversation:newConversation(),location:"all",reminders:false,toast:""};
  if(action.type==="logout")return {...state,user:null,doctors:[],comparison:[],appointments:[],applications:[],notifications:[],conversation:newConversation()};
  if(action.type==="cacheDoctors")return {...state,doctors:[...state.doctors.filter(d=>!action.doctors.some(n=>n.id===d.id)),...action.doctors]};
  return {...state,...action.patch};
}
interface AppContextValue extends AppState{
  t:(key:CopyKey|string)=>string;l:(value:Localized)=>string;money:(fee:number)=>string;
  patch:(patch:Partial<AppState>)=>void;setLanguage:(lang:Language)=>void;notify:(key:CopyKey)=>void;
  toggleFavorite:(id:string)=>Promise<void>;toggleCompare:(id:string)=>void;clearData:()=>void;logout:()=>Promise<void>;
  refreshData:()=>Promise<void>;cacheDoctors:(doctors:Doctor[])=>void;saveDoctor:(doctor:Doctor)=>Promise<void>;
  saveProfile:(value:{name?:string;phone?:string;language?:Language;location?:Governorate|"all";reminders?:boolean})=>Promise<void>;
}
const Context=createContext<AppContextValue|null>(null),STORAGE_KEY="meendoc.demo.preferences.v1";
const technicalCopy:Record<string,string>={saved:"savedBackend",fictionalDetails:"technicalContactNotice",safetyLong:"technicalSafetyLong",privacyPill:"technicalPrivacyPill",footerCopyright:"technicalCopyright",heroDescription:"technicalHeroDescription",stepGuide:"technicalStepGuide",stepGuideSub:"technicalStepGuideSub",stepUnderstand:"technicalStepUnderstand",stepUnderstandSub:"technicalStepUnderstandSub",faq3a:"applicationBackendNotice",cancelExplanation:"technicalCancelExplanation",clearDataQuestion:"privacyRequest",reminders:"technicalReminderPreference"};
export function AppProvider({children}:{children:ReactNode}){
  const [state,dispatch]=useReducer(reducer,initialState);
  const cacheDoctors=useCallback((doctors:Doctor[])=>dispatch({type:"cacheDoctors",doctors}),[]);
  const update=(patch:Partial<AppState>)=>dispatch({type:"patch",patch});
  const t=(key:CopyKey|string)=>{const resolved=state.integration?.mode!=="offline"?technicalCopy[key]||key:key;return Object.hasOwn(copy,resolved)?translate(resolved as CopyKey,state.lang):state.specialties.find(s=>s.slug===resolved)?.name[state.lang]||resolved;};
  const refreshData=async()=>{
    const integration=state.integration||await api.health();if(integration.mode==="offline")return;
    const profile=await api.me().catch(error=>{if(error instanceof ClientApiError&&error.status===401)return null;throw error;});
    const [catalog,announcements,directory]=await Promise.all([request<{doctors:Doctor[]}>("/api/doctors?pageSize=100"),api.announcements(),api.directories()]);
    const fields:Partial<AppState>={doctors:catalog.doctors,specialties:directory.specialties,subspecialties:directory.subspecialties,announcement:announcements[0]?localized(announcements[0].content,state.lang):"",user:profile?.user||null,appointments:[],applications:[],notifications:[]};
    if(profile){
      const [saved,appointments,notifications]=await Promise.all([api.favorites(),api.appointments(),api.notifications()]);
      Object.assign(fields,{favorites:saved,appointments,notifications,location:profile.location,reminders:profile.reminders});
      if(profile.user.roles?.includes("admin")){
        const [doctors,applications]=await Promise.all([request<Doctor[]>("/api/admin/doctors"),request<DoctorApplication[]>("/api/admin/applications")]);Object.assign(fields,{doctors,applications});
      }else if(profile.user.roles?.includes("doctor")){
        const [mine,applications]=await Promise.all([request<Doctor[]>("/api/doctor/profile"),request<DoctorApplication[]>("/api/doctor/applications")]);
        Object.assign(fields,{doctors:[...catalog.doctors.filter(d=>!mine.some(m=>m.id===d.id)),...mine],applications});
      }
    }
    update(fields);
  };
  useEffect(()=>{
    let preferences:Partial<AppState>={};
    try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");preferences={lang:raw.lang==="en"?"en":"ar",favorites:Array.isArray(raw.favorites)?raw.favorites.filter((id:unknown)=>typeof id==="string"&&id.length<80):[],location:["cairo","giza","alexandria"].includes(raw.location)?raw.location:"all",reminders:raw.reminders===true};}catch{}
    update({...preferences,hydrated:true});let active=true;
    const load=async()=>{
      try{
        const integration=await api.health();if(!active)return;update({integration});
        if(integration.mode==="offline")update({doctors:fixtures,applications:[{id:"APP-DEMO-01",name:"د. نهى المثال / Dr. Noha Example",specialty:"general",governorate:"cairo",area:"maadi",registration:"DEMO-ONLY",clinic:"DEMO",contact:"example@example.test",status:"pending"}],ready:true});
        else{const d=await api.directories();if(!active)return;update({specialties:d.specialties,subspecialties:d.subspecialties});await refreshData();if(active)update({ready:true});}
      }catch{if(active)update({ready:true,dataError:"INTEGRATION_UNAVAILABLE"});}
    };
    void load();return()=>{active=false;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{
    document.documentElement.lang=state.lang==="ar"?"ar-EG":"en";document.documentElement.dir=state.lang==="ar"?"rtl":"ltr";
    if(state.hydrated)try{localStorage.setItem(STORAGE_KEY,JSON.stringify({lang:state.lang,favorites:state.favorites,location:state.location,reminders:state.reminders}));}catch{}
  },[state.lang,state.favorites,state.location,state.reminders,state.hydrated]);
  useEffect(()=>{if(!state.toast)return;const timer=setTimeout(()=>update({toast:""}),3600);return()=>clearTimeout(timer);},[state.toast]);
  const patch=(value:Partial<AppState>)=>{
    if(state.integration?.mode==="demo"&&["doctors","appointments","user","applications","announcement"].some(k=>k in value)){update({toast:t("mutationFailed")});return;}
    update(value);
  };
  const saveProfile=async(value:Parameters<AppContextValue["saveProfile"]>[0])=>{
    if(state.integration?.mode==="demo"){await api.profile(value);await refreshData();}
    else update({...(value.name||value.phone?{user:{...state.user!,name:value.name||state.user?.name||"",phone:value.phone||state.user?.phone||""}}:{}),...(value.location?{location:value.location}:{}),...(value.reminders!==undefined?{reminders:value.reminders}:{})});
  };
  const setLanguage=(lang:Language)=>{update({lang});if(state.integration?.mode==="demo"&&state.user)void api.profile({language:lang}).catch(()=>update({toast:translate("mutationFailed",lang)}));};
  const toggleFavorite=async(id:string)=>{
    const saved=state.favorites.includes(id);
    try{if(state.integration?.mode==="demo"&&state.user){await api.favorite(id,!saved);update({favorites:await api.favorites()});}
      else update({favorites:saved?state.favorites.filter(x=>x!==id):[...state.favorites,id]});update({toast:t(saved?"favoriteRemoved":"favoriteAdded")});
    }catch{update({toast:t("mutationFailed")});}
  };
  const toggleCompare=(id:string)=>{if(state.comparison.includes(id))update({comparison:state.comparison.filter(x=>x!==id)});else if(state.comparison.length<3)update({comparison:[...state.comparison,id]});else update({toast:t("compareLimit")});};
  const saveDoctor=async(doctor:Doctor)=>{
    if(state.integration?.mode==="demo"){
      const admin=state.user?.roles?.includes("admin"),value={id:doctor.id,name:doctor.name,bio:doctor.bio,fee:doctor.fee,credentials:doctor.credentials,experience:doctor.experience,...(admin?{specialty:doctor.specialty,gender:doctor.gender,governorate:doctor.governorate,area:doctor.area,status:doctor.status||(doctor.active?"published":"inactive")}:{})};
      await request(admin?"/api/admin/doctors":"/api/doctor/profile","PATCH",value);await refreshData();
    }else update({doctors:state.doctors.map(d=>d.id===doctor.id?doctor:d)});
  };
  const logout=async()=>{try{if(state.integration?.mode==="demo")await request("/api/auth/logout","POST",{});dispatch({type:"logout"});if(state.integration?.mode==="demo")await refreshData();else update({doctors:fixtures});}catch{update({toast:t("mutationFailed")});}};
  const clearData=()=>{try{localStorage.removeItem(STORAGE_KEY);}catch{}dispatch({type:"clear"});};
  return <Context.Provider value={{...state,t,l:value=>localized(value,state.lang),money:fee=>new Intl.NumberFormat(state.lang==="ar"?"ar-EG":"en-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(fee),patch,setLanguage,notify:key=>update({toast:t(key)}),toggleFavorite,toggleCompare,saveDoctor,saveProfile,refreshData,cacheDoctors,logout,clearData}}>
    {children}
  </Context.Provider>;
}
export function useApp(){const context=useContext(Context);if(!context)throw new Error("Missing AppProvider");return context;}

