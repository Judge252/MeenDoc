import { writeFile } from "node:fs/promises";
import { doctors } from "../src/data/doctors";
import { specialtyKeys,areaKeys,areaGovernorate,translate } from "../src/lib/i18n";
const q=(v:unknown)=>"'"+String(v).replaceAll("'","''")+"'";
const j=(v:unknown)=>q(JSON.stringify(v))+"::jsonb";
const id=(group:number,n:number)=>String(group).repeat(8)+"-"+String(group).repeat(4)+"-4"+String(group).repeat(3)+"-8"+String(group).repeat(3)+"-"+String(n).padStart(12,"0");
const statements=["-- Fictional MEENDOC catalog only. Conflict-safe: existing records are not overwritten.","begin;"];
const specialties=new Map<string,string>(),governorates=new Map<string,string>(),cities=new Map<string,string>();
for(const [i,s] of specialtyKeys.entries()){
  specialties.set(s,id(1,i+1));
  statements.push("insert into public.specialties(id,slug,name_ar,name_en) values("+[q(id(1,i+1)),q(s),q(translate(s,"ar")),q(translate(s,"en"))].join(",")+") on conflict(slug) do nothing;");
  const example=doctors.find(d=>d.specialty===s)!;
  statements.push("insert into public.subspecialties(id,specialty_id,slug,name_ar,name_en) values("+[q(id(2,i+1)),q(id(1,i+1)),q(s+"-demo"),q(example.subspecialty.ar),q(example.subspecialty.en)].join(",")+") on conflict(slug) do nothing;");
}
for(const [i,g] of (["cairo","giza","alexandria"] as const).entries()){
  governorates.set(g,id(3,i+1));
  statements.push("insert into public.governorates(id,slug,name_ar,name_en) values("+[q(id(3,i+1)),q(g),q(translate(g,"ar")),q(translate(g,"en"))].join(",")+") on conflict(slug) do nothing;");
}
for(const [i,a] of areaKeys.entries()){
  cities.set(a,id(4,i+1));
  statements.push("insert into public.cities(id,governorate_id,slug,name_ar,name_en) values("+[q(id(4,i+1)),q(governorates.get(areaGovernorate[a])),q(a),q(translate(a,"ar")),q(translate(a,"en"))].join(",")+") on conflict(slug) do nothing;");
}
for(const [i,d] of doctors.entries()){
  const doctorId=id(5,i+1),clinicId=id(6,i+1),associationId=id(7,i+1);
  statements.push("insert into public.doctors(id,slug,name,gender,bio,services,portrait_index,status) values("+[q(doctorId),q(d.id),j(d.name),q(d.gender),j(d.bio),j(d.services),String(d.portrait),q("published")].join(",")+") on conflict(slug) do nothing;");
  statements.push("insert into public.doctor_specialties(doctor_id,specialty_id,subspecialty_id) values("+[q(doctorId),q(specialties.get(d.specialty)),q(id(2,specialtyKeys.indexOf(d.specialty as typeof specialtyKeys[number])+1))].join(",")+") on conflict do nothing;");
  statements.push("insert into public.clinics(id,name,address,governorate_id,city_id) values("+[q(clinicId),j({ar:"عيادة تجريبية "+(i+1),en:"Fictional demo clinic "+(i+1)}),j({ar:"عنوان توضيحي — "+translate(d.area as typeof areaKeys[number],"ar"),en:"Illustrative address — "+translate(d.area as typeof areaKeys[number],"en")}),q(governorates.get(d.governorate)),q(cities.get(d.area))].join(",")+") on conflict(id) do nothing;");
  statements.push("insert into public.doctor_clinics(id,doctor_id,clinic_id,fee_egp) values("+[q(associationId),q(doctorId),q(clinicId),String(d.fee)].join(",")+") on conflict(doctor_id,clinic_id) do nothing;");
  for(let day=0;day<7;day++)for(const time of d.slots){
    const [hour,minute]=time.split(":").map(Number),end=String(Math.floor((hour*60+minute+30)/60)).padStart(2,"0")+":"+String((minute+30)%60).padStart(2,"0");
    statements.push("insert into public.availability_rules(doctor_clinic_id,day_of_week,start_time,end_time,duration_minutes) values("+[q(associationId),String(day),q(time),q(end),"30"].join(",")+") on conflict do nothing;");
  }
}
statements.push("select public.generate_appointment_slots(14,null);","commit;");
await writeFile("supabase/seed.sql",statements.join("\n")+"\n");
console.log("Generated conflict-safe seed: 16 fictional doctors, 7 specialties, 7 subspecialties, 3 governorates, 7 cities.");
