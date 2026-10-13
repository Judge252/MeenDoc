import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin=process.argv[2];
if(!['http://127.0.0.1:3002','https://meendoc.vercel.app'].includes(origin))throw new Error('Use an explicitly approved smoke-test origin.');
const checks=[];
const profile='55555555-5555-4555-8555-000000000003';
async function check(path,status=200){const response=await fetch(origin+path,{redirect:'manual'});assert.equal(response.status,status,path);checks.push({path,status:response.status});return response;}
for(const path of ['/','/doctors','/doctors/'+profile,'/booking/'+profile,'/account','/appointments','/favorites','/login','/register','/otp','/forgot-password','/reset-password','/join-as-doctor'])await check(path);
for(const path of ['/admin','/doctor/dashboard']){
  const response=await fetch(origin+path,{redirect:'manual'}),expected='/login?next='+encodeURIComponent(path);
  if(response.status===307)assert.equal(response.headers.get('location'),expected,path);
  else{assert.equal(response.status,200,path);const html=await response.text();assert.ok(html.includes('__next-page-redirect')&&html.includes('url='+expected),path+' must contain the Next streaming redirect');assert.ok(!html.includes('class="dashboard-layout"'),path+' must not render management content');}
  checks.push({path,status:response.status,verifiedLoginRedirect:true});
}
for(const path of ['/api/me','/api/appointments','/api/admin/overview','/api/doctor/profile'])await check(path,401);
for(const path of ['/fonts/arabic-400.ttf','/fonts/inter-400.ttf','/images/fictional-doctors.png'])await check(path);
const health=await check('/api/health');assert.equal(health.headers.get('x-content-type-options'),'nosniff');assert.equal(health.headers.get('x-frame-options'),'DENY');assert.match(health.headers.get('cache-control')||'',/no-store/);const status=await health.json();assert.equal(status.data.mode,'demo');
for(const path of ['/api/specialties','/api/locations'])await check(path);
const matches=await (await check('/api/doctors?specialty=dermatology&governorate=cairo&maxFee=500')).json();assert.ok(matches.data.doctors.length);assert.ok(matches.data.doctors.every(doctor=>doctor.specialty==='dermatology'&&doctor.governorate==='cairo'&&doctor.fee<=500));
const slots=await (await check('/api/doctors/'+profile+'/availability')).json();assert.ok(slots.data.length);assert.ok(slots.data.every(slot=>slot.id&&slot.startsAt&&slot.endsAt));
const result={verifiedOn:'2026-10-13',origin,checks:checks.length,results:checks,geminiRequests:0,scope:'Production HTTP pages, assets, headers, public database API and guest authorization; authenticated workflows are verified separately.'};
await fs.mkdir('artifacts/cloud',{recursive:true});await fs.writeFile('artifacts/cloud/'+(origin.startsWith('https:')?'hosted':'local-production')+'-http-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({origin,checks:checks.length,result:'passed',geminiRequests:0}));
