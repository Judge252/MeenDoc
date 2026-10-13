import "server-only";
import { authorize } from "../auth/authorize";
import { adminClient } from "@/lib/supabase/admin";
import { databaseError,ApiError } from "../http";
import { directory,locations } from "../repositories/catalog";
import { configuration } from "../config";
export async function adminOverview(){
  await authorize("admin");const db=adminClient();
  const resources=["doctors","doctor_applications","appointments","feedback","privacy_requests"] as const;
  const result=await Promise.all(resources.map(async(table)=>{const r=await db.from(table).select("id",{count:"exact",head:true});databaseError(r.error);return [table,r.count||0] as const;}));
  const usage=await db.from("ai_usage_counters").select("request_count,token_count,model,window_start").eq("scope","ai_global").order("window_start",{ascending:false}).limit(7);databaseError(usage.error);
  const today=new Date(Math.floor(Date.now()/86400000)*86400000).toISOString(),requests=usage.data?.find(u=>new Date(u.window_start).toISOString()===today)?.request_count||0,limit=configuration().AI_DAILY_USAGE_LIMIT;
  return {counts:Object.fromEntries(result),aiUsage:usage.data||[],aiBudget:{requests,limit,warning:requests>=Math.floor(limit*0.8)}};
}
export async function adminRows(resource:string,page=1){
  const {db}=await authorize("admin");
  if(!["clinics","announcements","feedback","audit_events","privacy_requests"].includes(resource))throw new ApiError(404,"NOT_FOUND","Unknown resource.");
  const r=await db.from(resource).select("*").order("created_at",{ascending:false}).range((page-1)*50,page*50-1);databaseError(r.error);
  return r.data||[];
}
export async function adminWrite(resource:string,id:string|undefined,data:Record<string,unknown>){
  const {db}=await authorize("admin");const r=await db.rpc("admin_write",{p_resource:resource,p_id:id||null,p_data:data});databaseError(r.error);
  return r.data;
}
export async function editDirectory(value:{id?:string;slug:string;name:{ar:string;en:string};active:boolean;parentId?:string}){
  const row={slug:value.slug,name_ar:value.name.ar,name_en:value.name.en,active:value.active,...(value.parentId?{specialty_id:value.parentId}:{})};
  await adminWrite(value.parentId?"subspecialties":"specialties",value.id,row);return directory();
}
export async function editClinic(value:{id?:string;name:unknown;address:unknown;governorate:string;city:string;active:boolean}){
  const l=await locations(),g=l.governorates.find(g=>g.slug===value.governorate),city=l.cities.find(c=>c.slug===value.city&&c.parentId===g?.id);
  if(!g||!city)throw new ApiError(400,"INVALID_LOCATION","Choose a city in the selected governorate.");
  return adminWrite("clinics",value.id,{name:value.name,address:value.address,governorate_id:g.id,city_id:city.id,active:value.active});
}
export async function linkClinic(value:{doctorId:string;clinicId:string;fee:number}){
  await authorize("admin");const db=adminClient(),existing=await db.from("doctor_clinics").select("id").eq("doctor_id",value.doctorId).eq("clinic_id",value.clinicId).maybeSingle();databaseError(existing.error);
  return adminWrite("doctor_clinics",existing.data?.id,{doctor_id:value.doctorId,clinic_id:value.clinicId,fee_egp:value.fee,active:true,booking_enabled:true});
}
export async function providerAccounts(){
  await authorize("admin");const db=adminClient(),r=await db.auth.admin.listUsers({page:1,perPage:100});if(r.error)throw new ApiError(503,"ACCOUNTS_UNAVAILABLE","Provider account choices could not be loaded.");
  return r.data.users.map(u=>({id:u.id,email:u.email,confirmed:Boolean(u.email_confirmed_at)}));
}
