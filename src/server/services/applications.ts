import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";
import { authorize,currentUser } from "../auth/authorize";
import { directory,locations } from "../repositories/catalog";
import { databaseError,ApiError } from "../http";
import { limitRequest } from "./limits";
import type { DoctorApplication } from "@/types";
export function applicationDto(row:Record<string,unknown>,specialty:string,governorate:string):DoctorApplication{
  return {id:String(row.id),name:String(row.name),specialty:specialty as DoctorApplication["specialty"],governorate:governorate as DoctorApplication["governorate"],area:String(row.city_text),registration:String(row.registration_reference),clinic:String(row.clinic_information),contact:String(row.contact_email),status:row.status as DoctorApplication["status"],linkedUserId:row.applicant_user_id as string|null,doctorId:row.doctor_id as string|null,notes:String(row.review_notes||"")};
}
export async function submitApplication(request:Request,value:{name:string;specialty:string;governorate:string;area:string;registration:string;clinic:string;contact:string}){
  await limitRequest(request,"application",4);
  const [d,l,user]=await Promise.all([directory(),locations(),currentUser()]);
  const specialty=d.specialties.find(s=>s.slug===value.specialty&&s.active),governorate=l.governorates.find(g=>g.slug===value.governorate);
  if(!specialty||!governorate)throw new ApiError(400,"INVALID_DIRECTORY","Choose a valid specialty and governorate.");
  const db=adminClient(),r=await db.from("doctor_applications").insert({applicant_user_id:user?.id||null,name:value.name,specialty_id:specialty.id,governorate_id:governorate.id,city_text:value.area,registration_reference:value.registration,clinic_information:value.clinic,contact_email:value.contact.toLowerCase(),status:"pending"}).select("*").single();
  if(r.error?.code==="23505")throw new ApiError(409,"APPLICATION_PENDING","An application for this contact is already pending.");databaseError(r.error);
  const audit=await db.from("audit_events").insert({actor_id:user?.id||null,action:"application.submitted",target_entity:"doctor_applications",target_id:r.data?.id});databaseError(audit.error);
  return applicationDto(r.data!,value.specialty,value.governorate);
}
export async function listApplications(admin=false){
  const {db}=await authorize(admin?"admin":undefined),[d,l]=await Promise.all([directory(),locations()]);
  const r=await db.from("doctor_applications").select("*").order("created_at",{ascending:false}).limit(200);databaseError(r.error);
  return (r.data||[]).map(row=>applicationDto(row,d.specialties.find(s=>s.id===row.specialty_id)?.slug||"general",l.governorates.find(g=>g.id===row.governorate_id)?.slug||"cairo"));
}
export async function reviewApplication(value:{id:string;status:string;notes:string;linkedUserId:string|null;doctorId:string|null}){
  const {db}=await authorize("admin");const r=await db.rpc("review_doctor_application",{p_id:value.id,p_status:value.status,p_notes:value.notes,p_user:value.linkedUserId,p_doctor:value.doctorId});databaseError(r.error);
  return listApplications(true);
}
export async function feedback(request:Request,value:{category:string;rating:number;text:string}){
  await limitRequest(request,"feedback",6);
  const user=await (await serverClient()).auth.getUser(),db=adminClient();
  const r=await db.from("feedback").insert({user_id:user.data.user?.id||null,category:value.category,rating:value.rating,text:value.text}).select("id").single();databaseError(r.error);
  return {saved:true,id:r.data?.id};
}
