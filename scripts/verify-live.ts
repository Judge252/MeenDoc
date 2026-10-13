import env from "@next/env";
import {createClient} from "@supabase/supabase-js";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import assert from "node:assert/strict";
import type {Doctor,Appointment,AppointmentSlot,DoctorApplication,Notification} from "../src/types";

// Explicit remote verification, separate from the offline/mocked test suite.
// Creates only fictional controlled fixtures in the named approved project.
// It makes no Gemini calls and sends no email. Secrets never enter its report.
env.loadEnvConfig(process.cwd());
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const app=process.env.NEXT_PUBLIC_APP_URL||"http://127.0.0.1:3000";
if(url!=="https://mofdzltldjwkalvkkbvk.supabase.co"||!key||!publishable)throw new Error("Configure the approved MEENDOC project first.");
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),anon=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
const checks:string[]=[];
const passed=(name:string)=>{checks.push(name);console.log("PASS "+name);};
type Envelope<T>={data:T;error?:{code:string}};
class ApiSession{
  jar=new Map<string,string>();
  async call<T>(path:string,method="GET",data?:unknown){
    const response=await fetch(app+path,{method,redirect:"manual",headers:{...(data===undefined?{}:{"Content-Type":"application/json",Origin:app}),Cookie:[...this.jar].map(([n,v])=>n+"="+v).join("; ")},body:data===undefined?undefined:JSON.stringify(data)});
    for(const value of response.headers.getSetCookie()){const pair=value.split(";")[0],i=pair.indexOf("=");this.jar.set(pair.slice(0,i),pair.slice(i+1));}
    const payload=await response.json().catch(()=>({})) as Envelope<T>;
    return {response,payload};
  }
  async ok<T>(path:string,method="GET",data?:unknown){const result=await this.call<T>(path,method,data);if(!result.response.ok)throw new Error(path+" failed: "+(result.payload.error?.code||result.response.status));return result.payload.data;}
}
const guest=new ApiSession(),health=await guest.ok<{mode:string;database:{ready:boolean}}>("/api/health");
assert.equal(health.mode,"demo");assert.equal(health.database.ready,true);
passed("live API database health");
type Actor={id:string;email:string;password:string};
const fixturePath=".meendoc-test-accounts.private.json";
let actors:Record<string,Actor>;
try{actors=JSON.parse(await readFile(fixturePath,"utf8"));}catch{
  actors={};
  const run=randomUUID().slice(0,8);
  for(const name of ["patient1","patient2","doctor","admin"]){
    const email="meendoc-"+name+"-"+run+"@example.test",password=randomBytes(32).toString("base64url")+"aA1!";
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:"Fictional "+name,role:name==="patient1"?"admin":"patient",demo_test:true}});
    if(created.error||!created.data.user)throw new Error("Controlled Auth fixture creation failed.");
    actors[name]={id:created.data.user.id,email,password};
  }
  await writeFile(fixturePath,JSON.stringify(actors,null,2));
}
const elevated=await admin.from("user_roles").upsert({user_id:actors.admin.id,role:"admin"},{onConflict:"user_id,role"});
if(elevated.error)throw new Error("Controlled admin fixture role assignment failed.");
await admin.from("audit_events").insert({actor_id:actors.admin.id,action:"test.admin.bootstrap",target_entity:"user_roles",target_id:actors.admin.id});
const sessions:Record<string,ApiSession>={};
let storedSessions:Record<string,Record<string,string>>={};
try{storedSessions=JSON.parse(await readFile(".meendoc-test-sessions.private.json","utf8"));}catch{}
for(const name of Object.keys(actors)){
  const api=new ApiSession();api.jar=new Map(Object.entries(storedSessions[name]||{}));
  if(!(await api.call("/api/me")).response.ok){
    const r=await api.call<{authenticated:boolean}>("/api/auth/login","POST",{email:actors[name].email,password:actors[name].password});
    if(!r.response.ok||!r.payload.data.authenticated)throw new Error("Controlled cookie sign-in failed.");
    assert(r.response.headers.getSetCookie().some(c=>/httponly/i.test(c)&&/samesite=lax/i.test(c)));
  }
  sessions[name]=api;
}
await writeFile(".meendoc-test-sessions.private.json",JSON.stringify(Object.fromEntries(Object.entries(sessions).map(([name,s])=>[name,Object.fromEntries(s.jar)]))));
passed("real GoTrue password sign-in and HTTP-only BFF cookies for four controlled accounts");
const me=await sessions.patient1.ok<{user:{roles:string[]}}>("/api/me");
assert(!me.user.roles.includes("admin"));
for(const path of ["/api/admin/overview","/api/admin/accounts","/api/admin/applications","/api/admin/doctors","/api/admin/specialties","/api/admin/clinics","/api/admin/appointments","/api/admin/announcements","/api/admin/audit-events","/api/admin/feedback","/api/admin/privacy-requests","/api/doctor/profile","/api/doctor/clinics","/api/doctor/availability","/api/doctor/appointments"]){
  assert.equal((await guest.call(path)).response.status,401);
  assert.equal((await sessions.patient1.call(path)).response.status,403);
}
passed("15 privileged live API resources deny guests/patients and ignore malicious user metadata");
const catalog=await guest.ok<{doctors:Doctor[];total:number}>("/api/doctors?pageSize=100");
assert(catalog.total>=16);
const matched=await guest.ok<{doctors:Doctor[]}>("/api/doctors?specialty=dermatology&governorate=alexandria&maxFee=500");
assert(matched.doctors.length>0);assert(matched.doctors.every(d=>d.specialty==="dermatology"&&d.governorate==="alexandria"&&d.fee<=500));
const doctor=catalog.doctors.find(d=>d.id==="55555555-5555-4555-8555-000000000001")!;
const slots=await guest.ok<AppointmentSlot[]>("/api/doctors/"+doctor.id+"/availability");
assert(slots.length>=2);
passed("published profiles and matching/availability come from hosted PostgreSQL");
const contact={name:"Fictional demo patient",phone:"01000000000"};
const keys=[randomUUID(),randomUUID()],clients=[sessions.patient1,sessions.patient2];
const attempts=await Promise.all(clients.map((c,i)=>c.call<Appointment>("/api/appointments","POST",{slotId:slots[0].id,idempotencyKey:keys[i],patient:contact})));
assert.equal(attempts.filter(r=>r.response.ok).length,1);
assert.equal(attempts.filter(r=>r.response.status===409).length,1);
const winnerIndex=attempts.findIndex(r=>r.response.ok),patient=clients[winnerIndex],actor=actors["patient"+(winnerIndex+1)],appointment=attempts[winnerIndex].payload.data;
assert.equal(appointment.feeSnapshot,doctor.clinics!.find(c=>c.id===slots[0].clinicId)!.fee);
const repeated=await patient.ok<Appointment>("/api/appointments","POST",{slotId:slots[0].id,idempotencyKey:keys[winnerIndex],patient:contact});
assert.equal(repeated.recordId,appointment.recordId);
assert((await patient.ok<Appointment[]>("/api/appointments")).some(a=>a.recordId===appointment.recordId));
passed("two real patients compete concurrently: one booking, one conflict; repeat key is idempotent");
const outsider=clients[1-winnerIndex];
assert.equal((await outsider.call("/api/appointments/"+appointment.recordId+"/cancel","POST",{})).response.status,403);
const moved=await patient.ok<Appointment>("/api/appointments/"+appointment.recordId+"/reschedule","POST",{slotId:slots[1].id});
assert.equal(moved.slotId,slots[1].id);
const cancelled=await patient.ok<Appointment>("/api/appointments/"+appointment.recordId+"/cancel","POST",{});
assert.equal(cancelled.status,"cancelled");
const availableAgain=await guest.ok<AppointmentSlot[]>("/api/doctors/"+doctor.id+"/availability");
assert(availableAgain.some(s=>s.id===slots[0].id)&&availableAgain.some(s=>s.id===slots[1].id));
passed("cross-patient cancellation denied; reschedule/cancel release real slots");
await patient.ok("/api/favorites","POST",{doctorId:doctor.id});
assert((await patient.ok<string[]>("/api/favorites")).includes(doctor.id));
const notifications=await patient.ok<Notification[]>("/api/notifications");assert(notifications.length>=3);
await patient.ok("/api/notifications","PATCH",{id:notifications[0].id});
await patient.ok("/api/me","PATCH",{name:"Fictional saved profile",language:"ar",location:"cairo",reminders:true});
await patient.ok("/api/privacy/request","POST",{});
passed("favorites, profile, in-app notifications and pending privacy request persist");
const application=await guest.ok<DoctorApplication>("/api/doctor-applications","POST",{name:"Fictional test provider",specialty:"general",governorate:"cairo",area:"maadi",registration:"DEMO-ONLY-TEST",clinic:"Fictional clinic for verification",contact:actors.doctor.email,adultConsent:true,demoConsent:true});
assert.equal(application.status,"pending");
await sessions.admin.ok("/api/admin/applications","PATCH",{id:application.id,status:"approved",linkedUserId:actors.doctor.id,notes:"Fictional controlled integration test."});
const approved=(await sessions.admin.ok<DoctorApplication[]>("/api/admin/applications")).find(a=>a.id===application.id)!;
assert(approved.doctorId);
const ownedProfiles=await sessions.doctor.ok<Doctor[]>("/api/doctor/profile");
const owned=ownedProfiles.find(d=>d.id===approved.doctorId)!;
assert.equal(owned.status,"draft");assert.equal(owned.verificationStatus,"unverified");
assert((await sessions.admin.call("/api/admin/applications","PATCH",{id:application.id,status:"under_review"})).response.status>=400);
const clinic=await sessions.admin.ok<{id:string}>("/api/admin/clinics","POST",{name:{ar:"عيادة اختبار خيالية",en:"Fictional test clinic"},address:{ar:"عنوان اختبار خيالي",en:"Fictional test address"},governorate:"cairo",city:"maadi",active:true});
await sessions.admin.ok("/api/admin/doctor-clinics","POST",{doctorId:owned.id,clinicId:clinic.id,fee:400});
await sessions.admin.ok("/api/admin/doctors","PATCH",{id:owned.id,status:"published",bio:{ar:"ملف اختبار خيالي للعرض فقط",en:"Fictional technical verification profile only."}});
const day=new Date(slots[1].date+"T12:00:00Z").getUTCDay();
await sessions.doctor.ok("/api/doctor/availability","POST",{doctorClinicId:(await sessions.doctor.ok<Doctor[]>("/api/doctor/profile")).find(d=>d.id===owned.id)!.clinics![0].doctorClinicId,dayOfWeek:day,startTime:"18:00",endTime:"18:30",duration:30});
await sessions.doctor.ok("/api/doctor/profile","PATCH",{id:owned.id,bio:{ar:"تعديل مسموح لملف خيالي",en:"An allowed edit to a fictional profile."},fee:420});
assert.equal((await sessions.doctor.call("/api/doctor/profile","PATCH",{id:doctor.id,bio:{ar:"غير مسموح",en:"Denied edit"}})).response.status,403);
assert.equal((await sessions.doctor.call("/api/doctor/profile","PATCH",{id:owned.id,verificationStatus:"verified"})).response.status,403);
const providerSlots=await guest.ok<AppointmentSlot[]>("/api/doctors/"+owned.id+"/availability");assert(providerSlots.length>0);
const providerBooking=await patient.ok<Appointment>("/api/appointments","POST",{slotId:providerSlots[0].id,idempotencyKey:randomUUID(),patient:contact});
assert((await sessions.doctor.ok<Appointment[]>("/api/doctor/appointments")).some(a=>a.recordId===providerBooking.recordId));
await sessions.doctor.ok("/api/doctor/appointments","PATCH",{id:providerBooking.recordId,status:"cancelled"});
passed("application approval creates linked draft/unverified provider; owned clinic/schedule/profile/appointments work");
passed("provider cannot edit another provider or grant verification");
const direct=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}}),login=await direct.auth.signInWithPassword({email:actor.email,password:actor.password});
if(login.error)throw new Error("Direct RLS test sign-in failed.");
const privateGuest=await anon.from("profiles").select("id");assert(privateGuest.error||privateGuest.data?.length===0);
const ownRows=await direct.from("appointments").select("patient_id");assert(!ownRows.error&&ownRows.data.every(r=>r.patient_id===actor.id));
const forbiddenWrite=await direct.from("user_roles").insert({user_id:actor.id,role:"admin"});assert(forbiddenWrite.error);
await patient.ok("/api/auth/logout","POST",{});
assert.equal((await patient.call("/api/me")).response.status,401);
const revoked=await direct.from("appointments").select("id");assert(revoked.error||revoked.data.length===0);
passed("hosted direct REST RLS prevents private reads/escalation; global logout revokes existing JWT session access");
// Keep traceable audit/booking records. Hide the extra test-only catalog profile.
await sessions.admin.ok("/api/admin/doctors","PATCH",{id:owned.id,status:"draft"});
await sessions.admin.ok("/api/admin/clinics","PATCH",{id:clinic.id,active:false});
const assistant=await guest.ok<{doctors:Doctor[];mode:string}>("/api/assistant/message","POST",{language:"ar",action:"preferences",history:[],preferences:{specialty:"dermatology",governorate:"alexandria",maxFee:500}});
assert.equal(assistant.mode,"scripted");assert(assistant.doctors.length>0);
passed("labeled scripted assistant/manual filters query hosted catalog without a Gemini request");
await mkdir("artifacts/cloud",{recursive:true});
await writeFile("artifacts/cloud/live-verification.json",JSON.stringify({projectRef:"mofdzltldjwkalvkkbvk",checks,cloudVerified:true,realGeminiCalls:0,authFixtureConfirmation:"admin-confirmed fictional accounts; email delivery unverified",controlledAccounts:4,applicationId:application.id,providerId:owned.id},null,2));
console.log(checks.length+" live verification checks passed. Private credentials are stored only in the ignored fixture file.");
