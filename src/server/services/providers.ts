import "server-only";
import { authorize } from "../auth/authorize";
import { databaseError,ApiError } from "../http";
import { loadDoctor } from "../repositories/catalog";
export async function providerProfiles(admin=false){
  const {db,user}=await authorize(admin?"admin":"doctor");let q=db.from("doctors").select("id,linked_user_id").order("created_at");
  if(!admin)q=q.eq("linked_user_id",user.id);
  const r=await q;databaseError(r.error);
  return Promise.all((r.data||[]).map(async(row)=>({...await loadDoctor(row.id,true),linkedUserId:row.linked_user_id})));
}
export async function saveDoctor(value:Record<string,unknown>,admin=false){
  const {db}=await authorize(admin?"admin":"doctor");
  let id=value.id as string|undefined;
  if(!admin){const mine=await providerProfiles();if(!id)id=mine[0]?.id;if(!mine.some(d=>d.id===id))throw new ApiError(403,"FORBIDDEN","This profile is not linked to your provider account.");}
  const mapping:Record<string,string>={verificationStatus:"verification_status",linkedUserId:"linked_user_id"};
  const data=Object.fromEntries(Object.entries(value).filter(([k])=>k!=="id").map(([k,v])=>[mapping[k]||k,v]));
  const r=await db.rpc("configure_doctor",{p_id:id||null,p_data:data});databaseError(r.error);
  return loadDoctor(String(r.data),true);
}
export async function providerClinics(){
  const {db}=await authorize("doctor"),mine=await providerProfiles();if(!mine.length)return [];
  const r=await db.from("doctor_clinics").select("id,doctor_id,fee_egp,active,booking_enabled,clinics(*)").in("doctor_id",mine.map(d=>d.id));databaseError(r.error);return r.data||[];
}
export async function availability(){
  const {db}=await authorize("doctor"),clinics=await providerClinics();const ids=clinics.map(c=>c.id);
  if(!ids.length)return {rules:[],exceptions:[]};
  const [r,e]=await Promise.all([db.from("availability_rules").select("*").in("doctor_clinic_id",ids).order("day_of_week"),db.from("availability_exceptions").select("*").in("doctor_clinic_id",ids).order("date")]);databaseError(r.error);databaseError(e.error);
  return {rules:r.data||[],exceptions:e.data||[]};
}
export async function saveAvailability(value:Record<string,unknown>,exception=false){
  const {db}=await authorize("doctor");
  const map:Record<string,string>={dayOfWeek:"day_of_week",startTime:"start_time",endTime:"end_time",duration:"duration_minutes"};
  const data=Object.fromEntries(Object.entries(value).filter(([k])=>k!=="doctorClinicId").map(([k,v])=>[map[k]||k,v]));
  const r=await db.rpc("save_availability",{p_association:value.doctorClinicId,p_data:data,p_exception:exception});databaseError(r.error);
  return availability();
}
