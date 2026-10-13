import "server-only";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";
import { configuration } from "../config";
import { ApiError,databaseError } from "../http";
import { limitRequest,pseudonym } from "../services/limits";
import { matchDoctors,validatePreferences } from "../services/matching";
import { directory,locations } from "../repositories/catalog";
import { emptyPreferences } from "@/lib/mock-service";
import { GeminiProvider } from "./gemini";
import { systemPrompt } from "./prompt-v1";
import { emergencyInformation,uncertaintyInformation,enforceNavigation,fictionalScenarioSpecialties,SAFETY_VERSION } from "./safety-v1";
import type { MessageRequest,AIProvider } from "./contracts";
import type { Preferences } from "@/types";
export async function assistantMessage(request:Request,input:MessageRequest,provider:AIProvider=new GeminiProvider()){
  const c=configuration(),privileged=adminClient(),store=await cookies();
  const raw=store.get("md-chat")?.value,id=raw&&/^[0-9a-f-]{36}$/i.test(raw)?raw:null;
  const response=await privileged.rpc("assistant_session",{p_id:input.action==="restart"?null:id,p_patch:null});databaseError(response.error);
  const session=response.data as {id:string;preferences:Preferences;emergency_locked:boolean;consent_version:string|null};
  store.set("md-chat",session.id,{httpOnly:true,sameSite:"lax",secure:c.NEXT_PUBLIC_APP_URL.startsWith("https:"),path:"/",maxAge:86400});
  await limitRequest(request,"assistant",c.AI_REQUEST_LIMIT_PER_HOUR);
  await limitRequest(request,"assistant_session",c.AI_REQUEST_LIMIT_PER_HOUR,3600,session.id);
  const authenticated=await (await serverClient()).auth.getUser();
  if(authenticated.data.user)await limitRequest(request,"assistant_user",c.AI_REQUEST_LIMIT_PER_HOUR,3600,authenticated.data.user.id);
  const previous={...emptyPreferences,...session.preferences};
  const persist=async(patch:unknown)=>{const r=await privileged.rpc("assistant_session",{p_id:session.id,p_patch:patch});databaseError(r.error);};
  if(input.action==="restart"){return {sessionId:session.id,mode:"scripted",reply:"",preferences:emptyPreferences,action:"ask",safetyStatus:"navigation_only",doctors:[],phase:"intro",policyVersion:SAFETY_VERSION};}
  if(session.emergency_locked)return {sessionId:session.id,mode:"scripted",reply:emergencyInformation[input.language],preferences:previous,action:"stop",safetyStatus:"emergency_demo",doctors:[],phase:"emergency",policyVersion:SAFETY_VERSION};
  if(input.scenario==="emergency"){
    await persist({emergency_locked:true,phase:"emergency"});
    return {sessionId:session.id,mode:"scripted",reply:emergencyInformation[input.language],preferences:previous,action:"stop",safetyStatus:"emergency_demo",doctors:[],phase:"emergency",policyVersion:SAFETY_VERSION};
  }
  if(input.action==="preferences"&&input.preferences){
    const preferences=await validatePreferences(input.preferences as Preferences),results=await matchDoctors(preferences);
    await persist({preferences,phase:"results"});
    return {sessionId:session.id,mode:"scripted",reply:input.language==="ar"?"دي نتائج البحث في قاعدة البيانات حسب اختياراتك، مش توصية طبية.":"These database results match your filters. They are not medical recommendations.",preferences,action:"search",safetyStatus:"navigation_only",doctors:results.doctors,total:results.total,phase:"results"};
  }
  if(input.action==="scenario"||input.action==="scripted"){
    const s=input.scenario,preferences={...previous,...(s&&s in fictionalScenarioSpecialties?{specialty:fictionalScenarioSpecialties[s as keyof typeof fictionalScenarioSpecialties]}:{})};
    await persist({preferences,phase:"preferences"});
    return {sessionId:session.id,mode:"scripted",reply:s==="unknown"?uncertaintyInformation[input.language]:input.language==="ar"?"مثال خيالي للتجربة، والتوجيه محتاج مراجعة مختص. اختار مكانك وميزانيتك علشان نبحث في قاعدة البيانات.":"Fictional interface example; routing requires clinical review. Choose your location and budget for a database search.",preferences,action:"show_filters",safetyStatus:"uncertainty",doctors:[],phase:"preferences"};
  }
  if(!c.LIVE_AI_ENABLED||!c.GEMINI_API_KEY)throw new ApiError(503,"AI_UNAVAILABLE","Live Gemini is not enabled. Choose the labeled scripted mode.");
  if(!input.consent&&session.consent_version!=="meendoc-ai-v1")throw new ApiError(400,"CONSENT_REQUIRED","Adult fictional-demo and Google processing consent are required.");
  if(input.history.reduce((sum,m)=>sum+m.text.length,0)+input.message.length>c.AI_MAX_CONTEXT_CHARACTERS)throw new ApiError(413,"CONTEXT_TOO_LARGE","Please restart this conversation.");
  if(input.consent&&!session.consent_version){
    const user=await (await serverClient()).auth.getUser();
    const r=await privileged.from("consent_records").insert({user_id:user.data.user?.id||null,session_hash:pseudonym(session.id),version:"meendoc-ai-v1",scope:"adult-fictional-demo-google-text"});databaseError(r.error);
    await persist({consent_version:"meendoc-ai-v1"});
  }
  const d=await directory();
  const generated=await provider.generate({language:input.language,message:input.message,history:input.history,system:systemPrompt(input.language,d.specialties,previous),beforeAttempt:async()=>{await limitRequest(request,"ai_global",c.AI_DAILY_USAGE_LIMIT,86400,"global");}});
  const result=enforceNavigation(generated.output,input.message+"\n"+input.history.filter(m=>m.role==="user").map(m=>m.text).join("\n"),previous,d.specialties,input.language);
  const loc=await locations();
  const normalize=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u064b-\u065f]/g,"").replace(/[أإآ]/g,"ا").replace(/\s+/g," ").trim();
  const resolve=(value:string,items:{slug:string;name:{ar:string;en:string}}[])=>items.find(item=>[item.slug,item.name.ar,item.name.en].some(name=>normalize(name)===normalize(value)))?.slug||value;
  const preferences=await validatePreferences({...result.preferences,governorate:resolve(result.preferences.governorate,loc.governorates) as Preferences["governorate"],area:resolve(result.preferences.area,loc.cities)});
  const results=result.action==="search"&&result.safety==="navigation_only"?await matchDoctors(preferences):null;
  await persist({preferences,phase:results?"results":"preferences"});
  const tokens=await privileged.rpc("record_ai_tokens",{p_subject:pseudonym("ai_global:global"),p_model:generated.model,p_tokens:generated.tokens});databaseError(tokens.error);
  const reply=results?(input.language==="ar"?"لقيت "+results.total+" ملف خيالي في قاعدة البيانات حسب اختياراتك. ده بحث، مش توصية طبية.":"The database returned "+results.total+" fictional profiles matching your filters. This is a search, not a medical recommendation."):result.reply;
  return {sessionId:session.id,mode:"live",reply,preferences,action:result.action,safetyStatus:result.safety,doctors:results?.doctors||[],total:results?.total||0,phase:results?"results":"preferences",policyVersion:SAFETY_VERSION};
}
