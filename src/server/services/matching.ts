import "server-only";
import type { Preferences } from "@/types";
import { serverClient } from "@/lib/supabase/server";
import { ApiError,databaseError } from "../http";
import { directory,locations,loadDoctor } from "../repositories/catalog";
export async function validatePreferences(preferences:Preferences){
  const [d,l]=await Promise.all([directory(),locations()]);
  if(preferences.specialty!=="all"&&!d.specialties.some(s=>s.slug===preferences.specialty&&s.active))throw new ApiError(400,"UNKNOWN_SPECIALTY","Choose a listed specialty.");
  if(preferences.subspecialty!=="all"&&!d.subspecialties.some(s=>s.slug===preferences.subspecialty&&s.active&&(preferences.specialty==="all"||d.specialties.find(p=>p.id===s.parentId)?.slug===preferences.specialty)))throw new ApiError(400,"UNKNOWN_SUBSPECIALTY","Choose a listed subspecialty.");
  if(preferences.governorate!=="all"&&!l.governorates.some(g=>g.slug===preferences.governorate))throw new ApiError(400,"UNKNOWN_LOCATION","Choose a listed location.");
  if(preferences.area!=="all"&&!l.cities.some(c=>c.slug===preferences.area&&(preferences.governorate==="all"||l.governorates.find(g=>g.id===c.parentId)?.slug===preferences.governorate)))throw new ApiError(400,"UNKNOWN_LOCATION","Choose a city in the selected governorate.");
  return preferences;
}
export async function matchDoctors(preferences:Preferences,search={q:"",sort:"availability",page:1,pageSize:16,lang:"ar"}){
  await validatePreferences(preferences);
  const db=await serverClient();const result=await db.rpc("search_doctors",{p_filters:preferences,p_search:search.q,p_sort:search.sort,p_page:search.page,p_page_size:search.pageSize,p_language:search.lang});
  databaseError(result.error);
  const value=result.data as {items:{doctorId:string;clinicId:string}[];total:number};
  const doctors=await Promise.all((value.items||[]).map(item=>loadDoctor(item.doctorId,false,item.clinicId)));
  return {doctors,total:value.total,page:search.page,pageSize:search.pageSize,matchCriteria:preferences};
}
