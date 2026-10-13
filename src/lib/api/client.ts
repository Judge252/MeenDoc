import type { Doctor,Preferences,Patient,Appointment,AppointmentSlot,DirectoryItem,IntegrationStatus,Notification,DoctorApplication } from "@/types";
export class ClientApiError extends Error{constructor(public code:string,public status:number,message:string){super(message);}}
export async function request<T>(path:string,method="GET",data?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",headers:data===undefined?{}:{"Content-Type":"application/json"},body:data===undefined?undefined:JSON.stringify(data),signal});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new ClientApiError(result.error?.code||"REQUEST_FAILED",response.status,result.error?.message||"The request could not be completed.");
  return result.data as T;
}
export interface SearchResult {doctors:Doctor[];total:number;page:number;pageSize:number;matchCriteria:Preferences}
export const api={
  health:()=>request<IntegrationStatus>("/api/health"),
  directories:()=>request<{specialties:DirectoryItem[];subspecialties:DirectoryItem[]}>("/api/specialties"),
  locations:()=>request<{governorates:DirectoryItem[];cities:DirectoryItem[]}>("/api/locations"),
  doctors:(preferences:Preferences,q="",sort="availability",page=1,lang="ar",signal?:AbortSignal)=>request<SearchResult>("/api/doctors?"+new URLSearchParams({...Object.fromEntries(Object.entries(preferences).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)])),q,sort,page:String(page),pageSize:"16",lang}),"GET",undefined,signal),
  doctor:(id:string,signal?:AbortSignal)=>request<Doctor>("/api/doctors/"+encodeURIComponent(id),"GET",undefined,signal),
  slots:(id:string,clinicId?:string)=>request<AppointmentSlot[]>("/api/doctors/"+encodeURIComponent(id)+"/availability"+(clinicId?"?clinicId="+encodeURIComponent(clinicId):"")),
  me:()=>request<{user:Patient;location:string;language:"ar"|"en";reminders:boolean}>("/api/me"),
  profile:(data:unknown)=>request("/api/me","PATCH",data),
  favorites:()=>request<string[]>("/api/favorites"),
  favorite:(doctorId:string,saved:boolean)=>request("/api/favorites",saved?"POST":"DELETE",{doctorId}),
  appointments:()=>request<Appointment[]>("/api/appointments"),
  book:(slotId:string,idempotencyKey:string,patient:Patient)=>request<Appointment>("/api/appointments","POST",{slotId,idempotencyKey,patient:{name:patient.name,phone:patient.phone}}),
  cancel:(id:string)=>request<Appointment>("/api/appointments/"+id+"/cancel","POST",{}),
  reschedule:(id:string,slotId:string)=>request<Appointment>("/api/appointments/"+id+"/reschedule","POST",{slotId}),
  notifications:()=>request<Notification[]>("/api/notifications"),
  readNotification:(id:string)=>request("/api/notifications","PATCH",{id}),
  announcements:()=>request<{id:string;content:{ar:string;en:string}}[]>("/api/announcements"),
  apply:(data:unknown)=>request<DoctorApplication>("/api/doctor-applications","POST",data),
};
