import { test,expect,vi } from "vitest";
import { GeminiProvider } from "../../src/server/ai/gemini";
import { modelResponseSchema,type ModelResponse } from "../../src/server/ai/contracts";
import { enforceNavigation } from "../../src/server/ai/safety-v1";
import { emptyPreferences } from "../../src/lib/mock-service";
const good:ModelResponse={reply:"هنبحث حسب اختياراتك بس.",intent:"doctor_search",extractedPreferences:{specialty:"dermatology",specialtyEvidence:"جلدية",governorate:"alexandria",area:null,maxFee:500,gender:null,timing:null},nextQuestion:null,uiAction:"search",suggestedOptions:[],conversationStatus:"ready",safetyStatus:"navigation_only"};
const directory=[{id:"directory-1",slug:"dermatology",name:{ar:"جلدية",en:"Dermatology"},active:true}];
const input={language:"ar" as const,message:"عايز دكتور جلدية في اسكندرية والكشف ميعديش ٥٠٠ جنيه.",history:[],system:"Fictional navigation test only."};
test("official adapter validates structured Arabic extraction and usage",async()=>{
  const before=vi.fn(async()=>{}),generateContent=vi.fn(async()=>({text:JSON.stringify(good),usageMetadata:{totalTokenCount:123}}));
  const result=await new GeminiProvider({generateContent}).generate({...input,beforeAttempt:before});
  expect(result.output.extractedPreferences.maxFee).toBe(500);expect(result.tokens).toBe(123);expect(before).toHaveBeenCalledOnce();
  expect(generateContent.mock.calls[0]).toBeDefined();
});
test("unknown properties, arbitrary actions and malformed JSON cannot authorize tools",async()=>{
  expect(modelResponseSchema.safeParse({...good,uiAction:"grant_admin",doctorIds:["invented"]}).success).toBe(false);
  await expect(new GeminiProvider({generateContent:async()=>({text:"not json"})}).generate(input)).rejects.toMatchObject({code:"AI_INVALID_RESPONSE"});
});
test("quota error is surfaced without retries",async()=>{
  const call=vi.fn(async()=>{throw {status:429};});
  await expect(new GeminiProvider({generateContent:call}).generate(input)).rejects.toMatchObject({code:"AI_QUOTA_EXCEEDED"});
  expect(call).toHaveBeenCalledOnce();
});
test("one transient retry is controlled and reserves another request",async()=>{
  const call=vi.fn().mockRejectedValueOnce({status:503}).mockResolvedValueOnce({text:JSON.stringify(good)});
  const before=vi.fn(async()=>{});
  await new GeminiProvider({generateContent:call}).generate({...input,beforeAttempt:before});
  expect(call).toHaveBeenCalledTimes(2);expect(before).toHaveBeenCalledTimes(2);
});
test("explicit specialty evidence is required; symptoms cannot silently become specialties",()=>{
  const result=enforceNavigation({...good,extractedPreferences:{...good.extractedPreferences,specialtyEvidence:"طفح"}}, "عندي طفح خيالي",emptyPreferences,directory,"ar");
  expect(result.preferences.specialty).toBe("all");expect(result.action).toBe("show_filters");expect(result.safety).toBe("uncertainty");
});
test("non-directory model identifiers and clinical claims are rejected",()=>{
  expect(enforceNavigation({...good,extractedPreferences:{...good.extractedPreferences,specialty:"invented"}} ,input.message,emptyPreferences,directory,"ar").safety).toBe("uncertainty");
  expect(enforceNavigation({...good,reply:"You have a disease."},input.message,emptyPreferences,directory,"en").safety).toBe("uncertainty");
});
test("English search and corrected budget preserve explicit filters",()=>{
  const result=enforceNavigation({...good,reply:"I can search your chosen specialty.",extractedPreferences:{...good.extractedPreferences,specialtyEvidence:"Dermatology",maxFee:400}}, "Find Dermatology in Alexandria for 400 EGP",emptyPreferences,directory,"en");
  expect(result.preferences).toMatchObject({specialty:"dermatology",governorate:"alexandria",maxFee:400});expect(result.action).toBe("search");
});
test("adapter timeout produces a safe timeout error",async()=>{
  vi.stubEnv("GEMINI_TIMEOUT_MS","1000");
  const provider=new GeminiProvider({generateContent:params=>new Promise((_,reject)=>params.config?.abortSignal?.addEventListener("abort",()=>reject(new Error("aborted"))))});
  try{await expect(provider.generate(input)).rejects.toMatchObject({code:"AI_TIMEOUT"});}finally{vi.unstubAllEnvs();}
});
