import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { ApiError,body } from "../http";
import { authSchema } from "@/lib/validation/schemas";
import { authorize,safeNext } from "../auth/authorize";
import { configuration } from "../config";
import { limitRequest,pseudonym } from "./limits";
export async function authAction(request:Request,action:string){
  await limitRequest(request,"auth",15);
  const db=await serverClient(),c=configuration();
  if(action==="logout"){
    const result=await db.auth.signOut({scope:"global"});
    if(result.error)throw new ApiError(503,"LOGOUT_FAILED","Sign-out could not be completed. Please retry.");
    (await cookies()).delete("md-recovery");
    return {signedOut:true};
  }
  if(action==="login"||action==="register"){
    const value=await body(request,authSchema);
    if(action==="register"&&!value.adultConsent)throw new ApiError(400,"CONSENT_REQUIRED","Adult demo consent is required.");
    const result=action==="login"?await db.auth.signInWithPassword({email:value.email,password:value.password}):await db.auth.signUp({email:value.email,password:value.password,options:{data:{display_name:value.name||""},emailRedirectTo:c.NEXT_PUBLIC_APP_URL+"/auth/callback?next="+encodeURIComponent(safeNext(value.next))}});
    if(result.error)throw new ApiError(400,"AUTH_FAILED","Check your credentials and email confirmation, then retry.");
    return {authenticated:Boolean(result.data.session),confirmationRequired:!result.data.session,next:safeNext(value.next)};
  }
  if(action==="recovery"||action==="email-otp"){
    const value=await body(request,z.strictObject({email:z.email().max(160),next:z.string().max(300).optional()}));
    const result=action==="recovery"?await db.auth.resetPasswordForEmail(value.email,{redirectTo:c.NEXT_PUBLIC_APP_URL+"/auth/callback?next=/reset-password"}):await db.auth.signInWithOtp({email:value.email,options:{shouldCreateUser:false,emailRedirectTo:c.NEXT_PUBLIC_APP_URL+"/auth/callback?next="+encodeURIComponent(safeNext(value.next))}});
    if(result.error&&result.error.status===429)throw new ApiError(429,"AUTH_EMAIL_RATE_LIMIT","Email requests are temporarily rate limited.",60);
    if(result.error&&!["user_not_found","email_not_confirmed"].includes(result.error.code||""))throw new ApiError(503,"AUTH_EMAIL_UNAVAILABLE","The email provider could not complete this request.");
    // Avoid account enumeration; no statement claims delivery.
    return {requested:true,delivery:"provider-dependent"};
  }
  if(action==="verify-otp"){
    const value=await body(request,z.strictObject({email:z.email(),code:z.string().regex(/^\d{6,8}$/),next:z.string().max(300).optional()}));
    const result=await db.auth.verifyOtp({email:value.email,token:value.code,type:"email"});
    if(result.error||!result.data.session)throw new ApiError(400,"OTP_INVALID","The delivered code is invalid or expired.");
    return {authenticated:true,next:safeNext(value.next)};
  }
  if(action==="password"){
    const {user}=await authorize(),value=await body(request,z.strictObject({password:z.string().min(8).max(72)}));
    const marker=(await cookies()).get("md-recovery")?.value;
    const [stamp,signature]=marker?.split(".")||[];
    if(!stamp||!signature||Date.now()-Number(stamp)>15*60*1000||signature!==pseudonym("recovery:"+user.id+":"+stamp))throw new ApiError(403,"RECOVERY_REQUIRED","Open a fresh password recovery link first.");
    const result=await db.auth.updateUser({password:value.password});
    if(result.error)throw new ApiError(400,"PASSWORD_UPDATE_FAILED","The password could not be updated.");
    (await cookies()).delete("md-recovery");await db.auth.signOut({scope:"global"});
    return {updated:true};
  }
  throw new ApiError(404,"NOT_FOUND","Unknown authentication action.");
}
