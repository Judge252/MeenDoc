import "server-only";
import { z } from "zod";
import { configuration } from "./config";
export class ApiError extends Error {
  constructor(public status:number,public code:string,public message:string,public retryAfter?:number){super(message);}
}
export const unavailable=()=>new ApiError(503,"INTEGRATION_UNAVAILABLE","This integration is not configured or is unavailable.");
export function databaseError(error:{code?:string;message?:string}|null){
  if(!error)return;
  if(error.code==="23505"||error.message?.includes("SLOT_CONFLICT"))throw new ApiError(409,"SLOT_CONFLICT","The selected slot is no longer available.");
  if(error.message?.includes("IDEMPOTENCY_CONFLICT"))throw new ApiError(409,"IDEMPOTENCY_CONFLICT","This request key was already used for a different booking.");
  if(error.message?.includes("INVALID_TRANSITION"))throw new ApiError(409,"INVALID_TRANSITION","This appointment cannot be changed in its current state.");
  if(error.message?.includes("INVALID_SLOT"))throw new ApiError(409,"INVALID_SLOT","The selected slot has expired or is unavailable.");
  if(error.message?.includes("NOT_AUTHORIZED")||error.code==="42501")throw new ApiError(403,"FORBIDDEN","You do not have permission to perform this action.");
  if(error.message?.includes("RATE_LIMIT"))throw new ApiError(429,"RATE_LIMITED","The request limit has been reached. Please try again later.",60);
  throw new ApiError(503,"DATABASE_UNAVAILABLE","The database could not complete this request.");
}
export async function body<T>(request:Request,schema:z.ZodType<T>):Promise<T>{
  const length=Number(request.headers.get("content-length")||0);
  if(length>24000)throw new ApiError(413,"REQUEST_TOO_LARGE","Request is too large.");
  const reader=request.body?.getReader();let bytes=0;const parts:Uint8Array[]=[];
  if(reader)for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>24000){await reader.cancel();throw new ApiError(413,"REQUEST_TOO_LARGE","Request is too large.");}parts.push(value);}
  let input:unknown;
  try{input=JSON.parse(new TextDecoder().decode(Buffer.concat(parts)));}catch{throw new ApiError(400,"INVALID_JSON","A JSON request is required.");}
  const parsed=schema.safeParse(input);
  if(!parsed.success)throw new ApiError(400,"VALIDATION_ERROR","Please check the submitted fields.");
  return parsed.data;
}
export function sameOrigin(request:Request){
  if(["GET","HEAD"].includes(request.method))return;
  const origin=request.headers.get("origin"),expected=new URL(configuration().NEXT_PUBLIC_APP_URL).origin;
  if(!origin||origin!==expected)throw new ApiError(403,"ORIGIN_REJECTED","This request origin is not allowed.");
  if(request.headers.get("sec-fetch-site")==="cross-site")throw new ApiError(403,"ORIGIN_REJECTED","Cross-site requests are not allowed.");
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new ApiError(415,"JSON_REQUIRED","Use a JSON request.");
}
export async function respond(action:()=>Promise<unknown>){
  const requestId=crypto.randomUUID();
  const headers={"Cache-Control":"private, no-store","Vary":"Cookie","X-Request-Id":requestId,"X-Content-Type-Options":"nosniff"};
  try{return Response.json({data:await action(),requestId},{headers});}
  catch(error){
    const e=error instanceof ApiError?error:error instanceof z.ZodError?new ApiError(400,"VALIDATION_ERROR","Please check the submitted fields."):unavailable();
    if(e.status>=500)console.error(JSON.stringify({event:"api_failure",requestId,code:e.code}));
    return Response.json({error:{code:e.code,message:e.message},requestId},{status:e.status,headers:{...headers,...(e.retryAfter?{"Retry-After":String(e.retryAfter)}:{})}});
  }
}
