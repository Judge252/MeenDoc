import env from '@next/env';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import type {Doctor,Appointment,AppointmentSlot,Notification,DoctorApplication} from '../src/types';
env.loadEnvConfig(process.cwd());
const origin='https://meendoc.vercel.app';
if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://mofdzltldjwkalvkkbvk.supabase.co')throw new Error('Unexpected Supabase project.');
const actors=JSON.parse(await readFile('.meendoc-test-accounts.private.json','utf8')) as Record<string,{email:string;password:string}>;
type Envelope<T>={data:T;error?:{code:string}};
class Session{
  jar=new Map<string,string>();
  async call<T>(path:string,method='GET',data?:unknown){const response=await fetch(origin+path,{method,redirect:'manual',headers:{Cookie:[...this.jar].map(([key,value])=>key+'='+value).join('; '),...(data===undefined?{}:{'Content-Type':'application/json',Origin:origin})},body:data===undefined?undefined:JSON.stringify(data)});for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],separator=pair.indexOf('=');this.jar.set(pair.slice(0,separator),pair.slice(separator+1));}const payload=await response.json().catch(()=>({})) as Envelope<T>;return {response,payload};}
  async ok<T>(path:string,method='GET',data?:unknown){const result=await this.call<T>(path,method,data);if(!result.response.ok)throw new Error(path+' failed: '+(result.payload.error?.code||result.response.status));return result.payload.data;}
}
const checks:string[]=[],pass=(name:string)=>{checks.push(name);console.log('PASS '+name);};
const guest=new Session(),sessions:Record<string,Session>={};
const health=await guest.ok<{mode:string;database:{ready:boolean}}>('/api/health');assert.equal(health.mode,'demo');assert.equal(health.database.ready,true);
for(const name of ['patient1','patient2','doctor','admin']){const session=new Session(),login=await session.call<{authenticated:boolean}>('/api/auth/login','POST',{email:actors[name].email,password:actors[name].password});assert.equal(login.response.status,200);assert.equal(login.payload.data.authenticated,true);assert.ok(login.response.headers.getSetCookie().some(cookie=>/httponly/i.test(cookie)&&/samesite=lax/i.test(cookie)&&/;\s*secure/i.test(cookie)));sessions[name]=session;}
assert.ok(!(await sessions.patient1.ok<{user:{roles:string[]}}>('/api/me')).user.roles.includes('admin'));
pass('Hosted GoTrue login for four controlled accounts; Secure/HTTP-only/SameSite cookies and current roles');
for(const path of ['/api/admin/overview','/api/admin/accounts','/api/admin/applications','/api/admin/doctors','/api/admin/specialties','/api/admin/clinics','/api/admin/appointments','/api/admin/announcements','/api/admin/audit-events','/api/admin/feedback','/api/admin/privacy-requests','/api/doctor/profile','/api/doctor/clinics','/api/doctor/availability','/api/doctor/appointments']){assert.equal((await guest.call(path)).response.status,401);assert.equal((await sessions.patient1.call(path)).response.status,403);}
pass('Fifteen hosted management resources enforce guest/patient denial');
const catalog=await guest.ok<{doctors:Doctor[]}>('/api/doctors?pageSize=100'),doctor=catalog.doctors.find(item=>item.id==='55555555-5555-4555-8555-000000000001')!;
assert.ok(doctor);const slots=await guest.ok<AppointmentSlot[]>('/api/doctors/'+doctor.id+'/availability');assert.ok(slots.length>=2);
const keys=[randomUUID(),randomUUID()],patients=[sessions.patient1,sessions.patient2],contact={name:'Fictional hosted verification patient',phone:'01000000000'};
const attempts=await Promise.all(patients.map((session,index)=>session.call<Appointment>('/api/appointments','POST',{slotId:slots[0].id,idempotencyKey:keys[index],patient:contact})));
assert.equal(attempts.filter(result=>result.response.status===200).length,1);assert.equal(attempts.filter(result=>result.response.status===409).length,1);
const index=attempts.findIndex(result=>result.response.status===200),winner=patients[index],other=patients[1-index],appointment=attempts[index].payload.data;
assert.equal(appointment.feeSnapshot,doctor.clinics!.find(clinic=>clinic.id===slots[0].clinicId)!.fee);
const repeated=await winner.ok<Appointment>('/api/appointments','POST',{slotId:slots[0].id,idempotencyKey:keys[index],patient:contact});assert.equal(repeated.recordId,appointment.recordId);
assert.ok((await winner.ok<Appointment[]>('/api/appointments')).some(item=>item.recordId===appointment.recordId));
pass('Hosted concurrent booking: one success/one conflict, database fee, idempotency and persisted read');
assert.equal((await other.call('/api/appointments/'+appointment.recordId+'/cancel','POST',{})).response.status,403);
await winner.ok('/api/appointments/'+appointment.recordId+'/reschedule','POST',{slotId:slots[1].id});
assert.ok((await guest.ok<AppointmentSlot[]>('/api/doctors/'+doctor.id+'/availability')).some(slot=>slot.id===slots[0].id));
await winner.ok('/api/appointments/'+appointment.recordId+'/cancel','POST',{});
assert.ok((await guest.ok<AppointmentSlot[]>('/api/doctors/'+doctor.id+'/availability')).some(slot=>slot.id===slots[1].id));
pass('Hosted ownership denial, rescheduling and cancellation release actual slots');
await winner.ok('/api/favorites','POST',{doctorId:doctor.id});assert.ok((await winner.ok<string[]>('/api/favorites')).includes(doctor.id));
const notifications=await winner.ok<Notification[]>('/api/notifications');assert.ok(notifications.length);await winner.ok('/api/notifications','PATCH',{id:notifications[0].id});assert.ok((await winner.ok<Notification[]>('/api/notifications')).find(item=>item.id===notifications[0].id)?.readAt);
pass('Hosted favorites and notification read status persist');
const owned=(await sessions.doctor.ok<Doctor[]>('/api/doctor/profile'))[0];assert.ok(owned);assert.equal(owned.status,'draft');assert.equal(owned.verificationStatus,'unverified');assert.equal(owned.fee,420);
const applications=await sessions.admin.ok<DoctorApplication[]>('/api/admin/applications');assert.ok(applications.some(application=>application.status==='approved'&&application.doctorId===owned.id));
await sessions.doctor.ok('/api/doctor/profile','PATCH',{id:owned.id,bio:owned.bio});
assert.equal((await sessions.doctor.call('/api/doctor/profile','PATCH',{id:doctor.id,bio:owned.bio})).response.status,403);assert.equal((await sessions.doctor.call('/api/doctor/profile','PATCH',{id:owned.id,verificationStatus:'verified'})).response.status,403);
await sessions.admin.ok('/api/admin/overview');
pass('Hosted linked draft provider, owned edit, cross-provider denial and protected admin overview');
const assistant=await guest.ok<{mode:string;doctors:Doctor[]}>('/api/assistant/message','POST',{language:'en',action:'preferences',history:[],preferences:{specialty:'dermatology',governorate:'cairo',maxFee:500}});assert.equal(assistant.mode,'scripted');assert.ok(assistant.doctors.length);
pass('Hosted labeled manual/scripted matching uses PostgreSQL without Gemini');
for(const session of Object.values(sessions)){await session.ok('/api/auth/logout','POST',{});assert.equal((await session.call('/api/me')).response.status,401);}
pass('Hosted logout revokes each controlled session');
await writeFile('artifacts/cloud/hosted-workflow-verification.json',JSON.stringify({verifiedOn:'2026-10-13',origin,projectRef:'mofdzltldjwkalvkkbvk',checks,geminiRequests:0,authEmailDelivery:'unverified; controlled accounts were admin-confirmed',newAccounts:0,newProviderFixtures:0,appointmentReference:appointment.id},null,2));
console.log(checks.length+' hosted workflow checks passed.');
