import "server-only";
import { serverClient } from "@/lib/supabase/server";
import { ApiError,databaseError } from "../http";
export async function currentUser(){
  const db=await serverClient();const {data,error}=await db.auth.getUser();
  if(error||!data.user)return null;
  return data.user;
}
export async function authorize(role?:"doctor"|"admin"){
  const db=await serverClient(),{data,error}=await db.auth.getUser();
  if(error||!data.user)throw new ApiError(401,"AUTH_REQUIRED","Please sign in to continue.");
  const roles=await db.from("user_roles").select("role").eq("user_id",data.user.id);databaseError(roles.error);
  const assigned=(roles.data||[]).map(r=>String(r.role));
  if(role&&!assigned.includes(role))throw new ApiError(403,"FORBIDDEN","This action is restricted to authorized "+role+" accounts.");
  return {db,user:data.user,roles:assigned};
}
export function safeNext(value?:string){return value?.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\")&&!value.startsWith("/api/")?value:"/account";}
