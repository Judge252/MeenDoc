import env from "@next/env";
env.loadEnvConfig(process.cwd());
const {GeminiProvider}=await import("../src/server/ai/gemini");
const {systemPrompt}=await import("../src/server/ai/prompt-v1");
const {emptyPreferences}=await import("../src/lib/mock-service");
const directory=[{id:"fictional-specialty",slug:"dermatology",name:{ar:"جلدية",en:"Dermatology"},active:true}];
const provider=new GeminiProvider();
for(const [language,message] of [["ar","عايز دكتور جلدية خيالي في اسكندرية والكشف ميعديش ٥٠٠ جنيه."],["en","Find a fictional Dermatology doctor in Alexandria, maximum 500 EGP."]] as const){
  try{
    const r=await provider.generate({language,message,history:[],system:systemPrompt(language,directory,emptyPreferences)});
    console.log(JSON.stringify({language,model:r.model,intent:r.output.intent,preferences:r.output.extractedPreferences,tokens:r.tokens,validated:true}));
  }catch(error){console.log(JSON.stringify({language,verified:false,code:typeof error==="object"&&error!==null&&"code" in error?error.code:"AI_UNAVAILABLE"}));process.exitCode=1;}
}
