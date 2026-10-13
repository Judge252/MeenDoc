import "server-only";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { databaseError,ApiError } from "../http";
import { localized } from "@/lib/validation/schemas";
import type { Doctor,Clinic,AppointmentSlot,DirectoryItem,Governorate,Specialty } from "@/types";
const rawDoctor=z.object({id:z.string(),slug:z.string().nullable(),name:localized,gender:z.enum(["female","male"]),bio:localized,services:z.array(localized),portrait_index:z.number(),status:z.enum(["draft","published","inactive"]),verification_status:z.enum(["unverified","verified"])});
const joins="id,slug,name,gender,bio,services,credentials,experience,portrait_index,status,verification_status,doctor_specialties(specialties(id,slug,name_ar,name_en,active),subspecialties(id,slug,name_ar,name_en)),doctor_clinics(id,fee_egp,active,booking_enabled,clinics(id,name,address,active,governorates(id,slug,name_ar,name_en),cities(id,slug,name_ar,name_en)))";
type RawRelated={doctor_specialties:{specialties:{id:string;slug:Specialty;name_ar:string;name_en:string;active:boolean}|null;subspecialties:{id:string;slug:string;name_ar:string;name_en:string}|null}[];doctor_clinics:{id:string;fee_egp:number;active:boolean;booking_enabled:boolean;clinics:{id:string;name:{ar:string;en:string};address:{ar:string;en:string};active:boolean;governorates:{slug:Governorate};cities:{slug:string}}}[]};
export function egyptParts(timestamp:string){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(timestamp));
  const get=(part:string)=>parts.find(p=>p.type===part)?.value||"";
  return {date:get("year")+"-"+get("month")+"-"+get("day"),time:get("hour")+":"+get("minute")};
}
export async function availableSlots(doctorId:string,clinicId?:string):Promise<AppointmentSlot[]>{
  const db=await serverClient();
  let q=db.from("doctor_clinics").select("id,clinic_id").eq("doctor_id",doctorId).eq("active",true).eq("booking_enabled",true);
  if(clinicId)q=q.eq("clinic_id",clinicId);
  const associations=await q;databaseError(associations.error);
  if(!associations.data?.length)return [];
  const result=await db.from("appointment_slots").select("id,doctor_clinic_id,starts_at,ends_at").in("doctor_clinic_id",associations.data.map(a=>a.id)).eq("status","available").gt("starts_at",new Date().toISOString()).order("starts_at").limit(1500);
  databaseError(result.error);
  return (result.data||[]).map(s=>({id:s.id,doctorClinicId:s.doctor_clinic_id,clinicId:associations.data!.find(a=>a.id===s.doctor_clinic_id)!.clinic_id,startsAt:s.starts_at,endsAt:s.ends_at,...egyptParts(s.starts_at)}));
}
export async function loadDoctor(id:string,allowDraft=false,selectedClinicId?:string):Promise<Doctor>{
  const db=await serverClient();let query=db.from("doctors").select(joins);
  query=id.startsWith("doctor-")?query.eq("slug",id):query.eq("id",id);
  if(!allowDraft)query=query.eq("status","published");
  const result=await query.maybeSingle();databaseError(result.error);
  if(!result.data)throw new ApiError(404,"DOCTOR_NOT_FOUND","This fictional doctor profile is not available.");
  const parsed=rawDoctor.safeParse(result.data);if(!parsed.success)throw new ApiError(503,"INVALID_CATALOG_RECORD","The profile could not be loaded.");
  const raw=parsed.data,related=result.data as unknown as RawRelated;
  const specialty=related.doctor_specialties.find(s=>s.specialties?.active)||(allowDraft?related.doctor_specialties.find(s=>s.specialties):undefined);
  if(!specialty?.specialties&&!allowDraft)throw new ApiError(404,"DOCTOR_NOT_FOUND","This fictional doctor profile is not available.");
  const clinics:Clinic[]=related.doctor_clinics.filter(dc=>dc.clinics&&(allowDraft||dc.active&&dc.clinics.active)).map(dc=>({id:dc.clinics.id,doctorClinicId:dc.id,name:dc.clinics.name,address:dc.clinics.address,governorate:dc.clinics.governorates.slug,area:dc.clinics.cities.slug,fee:Number(dc.fee_egp),active:dc.active&&dc.clinics.active}));
  if(!clinics.length&&!allowDraft)throw new ApiError(404,"DOCTOR_NOT_FOUND","This fictional doctor profile has no active demo clinic.");
  const representative=clinics.find(c=>c.id===selectedClinicId)||clinics[0];
  const slots=await availableSlots(raw.id);
  const professional=result.data as unknown as {credentials:Doctor["credentials"];experience:Doctor["experience"]};
  return {id:raw.id,slug:raw.slug||undefined,name:raw.name,gender:raw.gender,bio:raw.bio,services:raw.services,portrait:raw.portrait_index,
    specialty:specialty?.specialties?.slug||"all",subspecialty:specialty?.subspecialties?{ar:specialty.subspecialties.name_ar,en:specialty.subspecialties.name_en}:{ar:"مثال تجريبي",en:"Demo example"},
    subspecialtySlug:specialty?.subspecialties?.slug,status:raw.status,verificationStatus:raw.verification_status,credentials:professional.credentials,experience:professional.experience,
    governorate:representative?.governorate||"cairo",area:representative?.area||"maadi",fee:representative?.fee||0,active:raw.status==="published",
    dayOffset:slots[0]?Math.max(0,Math.ceil((new Date(slots[0].startsAt).getTime()-Date.now())/86400000)):0,
    slots:[...new Set(slots.map(s=>s.time))],availableSlots:slots,clinics};
}
export async function directory(){
  const db=await serverClient();const [s,sub]=await Promise.all([db.from("specialties").select("id,slug,name_ar,name_en,active").order("slug"),db.from("subspecialties").select("id,slug,name_ar,name_en,active,specialty_id").order("slug")]);databaseError(s.error);databaseError(sub.error);
  const item=(row:{id:string;slug:string;name_ar:string;name_en:string;active?:boolean}):DirectoryItem=>({id:row.id,slug:row.slug,name:{ar:row.name_ar,en:row.name_en},active:row.active});
  return {specialties:(s.data||[]).map(item),subspecialties:(sub.data||[]).map(row=>({...item(row),parentId:row.specialty_id}))};
}
export async function locations(){
  const db=await serverClient();const [g,c]=await Promise.all([db.from("governorates").select("*").order("slug"),db.from("cities").select("*").order("slug")]);databaseError(g.error);databaseError(c.error);
  return {governorates:(g.data||[]).map(r=>({id:r.id,slug:r.slug,name:{ar:r.name_ar,en:r.name_en}})),cities:(c.data||[]).map(r=>({id:r.id,slug:r.slug,parentId:r.governorate_id,name:{ar:r.name_ar,en:r.name_en}}))};
}
