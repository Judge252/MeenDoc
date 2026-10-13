import type { ModelResponse } from "./contracts";
import type { DirectoryItem,Preferences } from "@/types";
export const SAFETY_VERSION="meendoc-demo-safety-v1";
export const emergencyInformation={ar:"دي رسالة توضيحية، مش تقييم لحالتك. لو بتواجه حالة طارئة فعلًا، اطلب مساعدة طبية عاجلة أو توجّه لأقرب قسم طوارئ. ماتستناش حجز عادي أو رد التطبيق.",en:"This is information, not an assessment of your condition. If you are experiencing an actual emergency, seek urgent medical help or go to the nearest emergency department. Do not wait for routine booking or an app response."};
export const uncertaintyInformation={ar:"مش هنحوّل وصف أعراض غير مراجع لتشخيص أو تخصص طبي. تقدر تبحث عن تخصص إنت محدده، أو تجرب مثال خيالي. التوجيه الطبي محتاج مراجعة مختص.",en:"We do not turn unreviewed symptoms into diagnoses or specialty recommendations. Search for a specialty you choose or use a fictional example. Medical routing requires professional review."};
const aliases:Record<string,string[]>={dermatology:["جلدية","جلديه","dermatology","dermatologist"],ophthalmology:["عيون","ophthalmology","ophthalmologist","eye doctor"],orthopedics:["عظام","orthopedics","orthopaedics","orthopedist"],cardiology:["قلب","cardiology","cardiologist"],dentistry:["اسنان","أسنان","dentistry","dentist"],ent:["انف واذن","أنف وأذن","ent","otolaryngology"],general:["باطنة","general","internal medicine"]};
const normal=(s:string)=>s.toLowerCase().normalize("NFKD").replace(/[\u064b-\u065f]/g,"").replace(/[أإآ]/g,"ا").replace(/\s+/g," ").trim();
export function enforceNavigation(output:ModelResponse,text:string,previous:Preferences,directory:DirectoryItem[],language:"ar"|"en"){
  const proposed=output.extractedPreferences.specialty,evidence=output.extractedPreferences.specialtyEvidence;
  const known=proposed?directory.find(d=>d.slug===proposed&&d.active):undefined;
  const explicit=Boolean(known&&evidence&&normal(text).includes(normal(evidence))&&[known.name.ar,known.name.en,...(aliases[known.slug]||[])].some(term=>normal(evidence)===normal(term)));
  // This is scope enforcement, not clinical detection or triage.
  const disallowedClaim=/\b(diagnos(?:is|ed)|you have|take \d|prescrib|probability of|medically safe|best doctor|reservation confirmed|I booked)\b|\bDr\.|د\.|تشخيصك|عندك مرض|خد دواء|نسبة إصابتك|حجزتلك/i.test(output.reply+" "+(output.nextQuestion||""));
  const unsafe=["unsupported","uncertainty","emergency_information"].includes(output.safetyStatus)||["unsupported","uncertainty","emergency_information"].includes(output.intent)||disallowedClaim||(Boolean(proposed)&&!explicit);
  if(unsafe)return {reply:uncertaintyInformation[language],intent:"uncertainty" as const,preferences:previous,action:"show_filters" as const,safety:"uncertainty" as const};
  const extracted=output.extractedPreferences;
  const preferences:Preferences={...previous,...(explicit?{specialty:proposed as Preferences["specialty"],subspecialty:"all"}:{}),
    ...(extracted.governorate?{governorate:extracted.governorate as Preferences["governorate"],area:"all"}:{}),
    ...(extracted.area?{area:extracted.area}:{}),...(extracted.maxFee!==null?{maxFee:extracted.maxFee}:{}),...(extracted.gender?{gender:extracted.gender}:{}),...(extracted.timing?{timing:extracted.timing}:{})};
  const question=output.nextQuestion?.trim(),reply=output.reply.trim();
  return {reply:reply+(question&&!normal(reply).includes(normal(question))?"\n"+question:""),intent:output.intent,preferences,action:output.uiAction,safety:"navigation_only" as const};
}
export const fictionalScenarioSpecialties={eyes:"ophthalmology",skin:"dermatology",joint:"orthopedics"} as const;
