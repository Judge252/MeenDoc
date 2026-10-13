import "server-only";
import { GoogleGenAI,type GenerateContentParameters } from "@google/genai";
import { configuration } from "../config";
import { ApiError } from "../http";
import { modelResponseSchema,providerJsonSchema,type AIProvider,type AIProviderResult } from "./contracts";
type Transport={generateContent:(params:GenerateContentParameters)=>Promise<{text?:string;usageMetadata?:{totalTokenCount?:number}}>}
export class GeminiProvider implements AIProvider{
  constructor(private transport?:Transport){}
  async generate(input:Parameters<AIProvider["generate"]>[0]):Promise<AIProviderResult>{
    const c=configuration();
    if(!c.GEMINI_API_KEY&&!this.transport)throw new ApiError(503,"AI_UNAVAILABLE","Gemini is not configured.");
    const transport=this.transport||new GoogleGenAI({apiKey:c.GEMINI_API_KEY,httpOptions:{timeout:c.GEMINI_TIMEOUT_MS,retryOptions:{attempts:1}}}).models;
    for(let attempt=0;attempt<2;attempt++){
      await input.beforeAttempt?.();
      const signal=AbortSignal.timeout(c.GEMINI_TIMEOUT_MS);
      try{
        const response=await transport.generateContent({model:c.GEMINI_MODEL,contents:[...input.history.slice(-c.AI_MAX_HISTORY_MESSAGES).map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.text}]})),{role:"user",parts:[{text:input.message||"Welcome the user to this fictional navigation demonstration."}]}],
          config:{systemInstruction:input.system,maxOutputTokens:c.AI_MAX_OUTPUT_TOKENS,responseMimeType:"application/json",responseJsonSchema:providerJsonSchema(),temperature:0.2,abortSignal:signal}});
        if(!response.text||response.text.length>7000)throw new ApiError(502,"AI_INVALID_RESPONSE","Gemini returned an invalid navigation response.");
        let output:unknown;try{output=JSON.parse(response.text);}catch{throw new ApiError(502,"AI_INVALID_RESPONSE","Gemini returned an invalid navigation response.");}
        const result=modelResponseSchema.safeParse(output);
        if(!result.success)throw new ApiError(502,"AI_INVALID_RESPONSE","Gemini returned an invalid navigation response.");
        return {output:result.data,tokens:response.usageMetadata?.totalTokenCount||0,model:c.GEMINI_MODEL};
      }catch(error){
        if(error instanceof ApiError)throw error;
        const status=typeof error==="object"&&error!==null?Number((error as {status?:number}).status):0;
        if(status===429)throw new ApiError(429,"AI_QUOTA_EXCEEDED","Gemini quota is exhausted. Use the labeled scripted mode or try later.",60);
        if(signal.aborted)throw new ApiError(504,"AI_TIMEOUT","Gemini did not respond in time.");
        if(attempt===0&&[500,502,503,504].includes(status)){await new Promise(resolve=>setTimeout(resolve,150));continue;}
        throw new ApiError(503,"AI_UNAVAILABLE","Gemini could not complete this request.");
      }
    }
    throw new ApiError(503,"AI_UNAVAILABLE","Gemini could not complete this request.");
  }
}
