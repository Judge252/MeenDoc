import { z } from "zod";
import { preferencesSchema } from "@/lib/validation/schemas";
export const intents=z.enum(["greeting","doctor_search","specialty_search","update_preferences","request_availability","show_results","unsupported","uncertainty","emergency_information"]);
export const modelResponseSchema=z.strictObject({
  reply:z.string().min(1).max(600),intent:intents,
  extractedPreferences:z.strictObject({
    specialty:z.string().max(70).nullable(),specialtyEvidence:z.string().max(100).nullable(),
    governorate:z.string().max(70).nullable(),area:z.string().max(70).nullable(),
    maxFee:z.number().min(0).max(5000).nullable(),gender:z.enum(["female","male"]).nullable(),
    timing:z.enum(["morning","evening"]).nullable(),
  }),
  nextQuestion:z.string().max(180).nullable(),
  uiAction:z.enum(["ask","show_filters","search","stop"]),
  suggestedOptions:z.array(z.string().max(100)).max(4),
  conversationStatus:z.enum(["clarifying","ready","unsupported","stopped"]),
  safetyStatus:z.enum(["navigation_only","uncertainty","unsupported","emergency_information"]),
});
export const messageSchema=z.strictObject({
  message:z.string().trim().max(1000).default(""),language:z.enum(["ar","en"]),
  action:z.enum(["message","preferences","restart","scenario","scripted"]).default("message"),
  scenario:z.enum(["eyes","skin","joint","unknown","emergency"]).optional(),
  preferences:preferencesSchema.optional(),
  history:z.array(z.strictObject({role:z.enum(["user","assistant"]),text:z.string().max(1000)})).max(16).default([]),
  consent:z.strictObject({adult:z.literal(true),fictional:z.literal(true),google:z.literal(true),version:z.literal("meendoc-ai-v1")}).optional(),
});
export type ModelResponse=z.infer<typeof modelResponseSchema>;
export type MessageRequest=z.infer<typeof messageSchema>;
export interface AIProviderResult {output:ModelResponse;tokens:number;model:string}
export interface AIProvider {generate(input:{language:"ar"|"en";message:string;history:MessageRequest["history"];system:string;beforeAttempt?:()=>Promise<void>}):Promise<AIProviderResult>}
export function providerJsonSchema(){
  const source=z.toJSONSchema(modelResponseSchema);
  const keep=new Set(["type","properties","required","additionalProperties","items","enum","anyOf","minimum","maximum"]);
  const clean=(value:unknown):unknown=>{
    if(Array.isArray(value))return value.map(clean);
    if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([k])=>keep.has(k)).map(([k,v])=>[k,k==="properties"?Object.fromEntries(Object.entries(v as Record<string,unknown>).map(([name,item])=>[name,clean(item)])):clean(v)]));
    return value;
  };
  return clean(source);
}
