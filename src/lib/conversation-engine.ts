import type { CopyKey } from "@/lib/i18n";
import type { Specialty, Preferences } from "@/types";
import { emptyPreferences } from "@/lib/mock-service";
export type Phase="intro"|"choose"|"duration"|"impact"|"preferences"|"results"|"uncertain"|"emergency";
export type Scenario="eyes"|"skin"|"joint"|"unknown"|"emergency";
export interface ChatMessage { id:number; role:"assistant"|"user"; key?:CopyKey; raw?:string; at:number }
export interface Conversation {phase:Phase;scenario:Scenario|null;specialty:Specialty|"all";messages:ChatMessage[];preferences:Preferences}
export const newConversation=():Conversation=>({phase:"intro",scenario:null,specialty:"all",messages:[],preferences:{...emptyPreferences}});
const scenarioKey:Record<Scenario,CopyKey>={eyes:"scenarioEyes",skin:"scenarioSkin",joint:"scenarioJoint",unknown:"scenarioUnknown",emergency:"scenarioEmergency"};
const scenarioSpecialty:Partial<Record<Scenario,Specialty>>={eyes:"ophthalmology",skin:"dermatology",joint:"orthopedics"};
export function transition(current:Conversation, action:{type:"start";key:CopyKey}|{type:"free";text:string}|{type:"scenario";scenario:Scenario}|{type:"answer";key:CopyKey}|{type:"preferences";preferences:Preferences}|{type:"change"}):Conversation {
  if(current.phase==="emergency")return current;
  let phase:Phase=current.phase,scenario=current.scenario,specialty=current.specialty,preferences=current.preferences;
  const added:Omit<ChatMessage,"id"|"at">[]=[];
  if(action.type==="start"){added.push({role:"user",key:action.key}); if(action.key==="starterNear"||action.key==="starterBudget"||action.key==="starterBrowse"){phase="preferences";added.push({role:"assistant",key:"preferencesSub"});}else{phase="choose";added.push({role:"assistant",key:"chooseScenario"});}}
  if(action.type==="free"){phase="uncertain";added.push({role:"user",raw:action.text},{role:"assistant",key:"uncertainMessage"});}
  if(action.type==="scenario"){
    scenario=action.scenario;added.push({role:"user",key:scenarioKey[scenario]});
    if(scenario==="emergency"){phase="emergency";added.push({role:"assistant",key:"emergencyMessage"});}
    else if(scenario==="unknown"){phase="uncertain";added.push({role:"assistant",key:"uncertainMessage"});}
    else{specialty=scenarioSpecialty[scenario]??"all";phase="duration";added.push({role:"assistant",key:"durationQuestion"});}
  }
  if(action.type==="answer"){
    added.push({role:"user",key:action.key});
    if(action.key==="urgent"){phase="emergency";added.push({role:"assistant",key:"emergencyMessage"});}
    else if(action.key==="unsure"){phase="uncertain";added.push({role:"assistant",key:"uncertainMessage"});}
    else if(current.phase==="duration"){phase="impact";added.push({role:"assistant",key:"impactQuestion"});}
    else if(current.phase==="impact"){phase="preferences";preferences={...emptyPreferences,specialty};added.push({role:"assistant",key:"recommendationNote"});}
  }
  if(action.type==="preferences"){phase="results";preferences=action.preferences;specialty=preferences.specialty;added.push({role:"assistant",key:"matchesTitle"});}
  if(action.type==="change"){phase="preferences";}
  return {...current,phase,scenario,specialty,preferences,messages:[...current.messages,...added.map((m,i)=>({...m,id:current.messages.length+i,at:Date.now()}))]};
}
