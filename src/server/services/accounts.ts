import "server-only";
import { authorize } from "../auth/authorize";
import { databaseError,ApiError } from "../http";
import type { Patient } from "@/types";
export async function me(){
  const {db,user,roles}=await authorize(),result=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();databaseError(result.error);
  if(!result.data)throw new ApiError(403,"PROFILE_UNAVAILABLE","Your account profile is unavailable.");
  const p=result.data;
  return {user:{id:user.id,email:user.email,name:p.display_name||user.email||"",phone:p.phone||"",roles:roles as Patient["roles"]},language:p.language,location:p.preferred_governorate||"all",reminders:p.reminders};
}
export async function updateMe(value:{name?:string;phone?:string;language?:string;location?:string;reminders?:boolean}){
  const {db,user}=await authorize();
  const result=await db.from("profiles").update(Object.fromEntries(Object.entries({display_name:value.name,phone:value.phone,language:value.language,preferred_governorate:value.location,reminders:value.reminders}).filter(([,v])=>v!==undefined))).eq("id",user.id).select("id").single();databaseError(result.error);
  return me();
}
export async function favorites(method:string,doctorId?:string){
  const {db,user}=await authorize();
  if(method==="POST"){const r=await db.from("favorites").upsert({patient_id:user.id,doctor_id:doctorId},{onConflict:"patient_id,doctor_id",ignoreDuplicates:true});databaseError(r.error);}
  if(method==="DELETE"){const r=await db.from("favorites").delete().eq("patient_id",user.id).eq("doctor_id",doctorId!);databaseError(r.error);}
  const r=await db.from("favorites").select("doctor_id").eq("patient_id",user.id).order("created_at",{ascending:false});databaseError(r.error);return (r.data||[]).map(row=>row.doctor_id as string);
}
export async function notifications(id?:string){
  const {db,user}=await authorize();
  if(id){const r=await db.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("recipient_id",user.id);databaseError(r.error);}
  const r=await db.from("notifications").select("*").eq("recipient_id",user.id).order("created_at",{ascending:false}).limit(100);databaseError(r.error);
  return (r.data||[]).map(row=>({id:row.id,category:row.category,content:row.content,readAt:row.read_at,createdAt:row.created_at}));
}
export async function privacyRequest(){
  const {db,user}=await authorize();const existing=await db.from("privacy_requests").select("id").eq("user_id",user.id).eq("status","pending").limit(1);databaseError(existing.error);
  if(existing.data?.length)return {requested:true,id:existing.data[0].id};
  const r=await db.from("privacy_requests").insert({user_id:user.id,status:"pending"}).select("id").single();databaseError(r.error);
  return {requested:true,id:r.data?.id};
}
