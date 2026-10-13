import "server-only";
import { createHmac } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { configuration,privilegedKey } from "../config";
import { databaseError,unavailable } from "../http";
export function pseudonym(value:string){
  const secret=configuration().RATE_LIMIT_SECRET||privilegedKey();if(!secret)throw unavailable();
  return createHmac("sha256",secret).update(value).digest("hex");
}
export async function limitRequest(request:Request,scope:string,limit:number,windowSeconds=3600,subject?:string){
  // Vercel sets this trusted ingress header. Outside that deployment, use a
  // conservative shared anonymous bucket instead of trusting user-supplied IPs.
  const ingress=process.env.VERCEL==="1"?request.headers.get("x-vercel-forwarded-for")||"guest":"local-guest";
  const hash=pseudonym(scope+":"+(subject||ingress)),db=adminClient();
  const result=await db.rpc("consume_request_limit",{p_subject:hash,p_scope:scope,p_limit:limit,p_window_seconds:windowSeconds});databaseError(result.error);
  return {hash,...result.data as {used:number;limit:number;warning:boolean}};
}
