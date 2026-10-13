import { beforeAll,afterAll,test,expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { migrationDatabase,testIdentity } from "../../scripts/db-harness";
let db:PGlite;
const patientA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",patientB="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const doctorUser="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",adminUser="cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const doctorId="55555555-5555-4555-8555-000000000001";
let slot:string,otherSlot:string,appointment:{id:string;reference:string;slot_id:string;fee_snapshot:string};
beforeAll(async()=>{
  db=await migrationDatabase();
  await testIdentity(db,patientA);await testIdentity(db,patientB);await testIdentity(db,doctorUser);await testIdentity(db,adminUser);
  await db.exec("reset role");
  await db.query("insert into public.user_roles(user_id,role) values($1,'doctor'),($2,'admin')",[doctorUser,adminUser]);
  await db.query("update public.doctors set linked_user_id=$1 where id=$2",[doctorUser,doctorId]);
  const result=await db.query<{id:string}>("select s.id from public.appointment_slots s join public.doctor_clinics dc on dc.id=s.doctor_clinic_id where dc.doctor_id=$1 and s.status='available' and s.starts_at>now()+interval '1 day' order by s.starts_at limit 2",[doctorId]);
  [slot,otherSlot]=result.rows.map(r=>r.id);
});
afterAll(async()=>{await db.close();});
test("fresh migrations, seed and conflict-safe repeat preserve catalog",async()=>{
  await db.exec("reset role");
  await db.exec(await readFile("supabase/seed.sql","utf8"));
  const counts=await db.query<{doctors:number;specialties:number}>("select (select count(*) from public.doctors)::int doctors,(select count(*) from public.specialties)::int specialties");
  expect(counts.rows[0]).toEqual({doctors:16,specialties:7});
  const rls=await db.query<{count:number}>("select count(*)::int from pg_tables where schemaname='public' and not rowsecurity");
  expect(rls.rows[0].count).toBe(0);
});
test("guest reads published profiles and cannot read private data or book",async()=>{
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon");
  expect((await db.query("select id from public.doctors")).rows).toHaveLength(16);
  await expect(db.query("select * from public.profiles")).rejects.toThrow(/permission denied/);
  await expect(db.query("select public.book_appointment($1,$2,'Fictional visitor','01012345678')",[slot,crypto.randomUUID()])).rejects.toThrow(/permission denied/);
});
test("patients cannot promote roles or use admin functions",async()=>{
  await testIdentity(db,patientA);
  await expect(db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[patientA])).rejects.toThrow(/permission denied/);
  await expect(db.query("select public.admin_write('doctors',$1,'{\"status\":\"inactive\"}'::jsonb)",[doctorId])).rejects.toThrow(/NOT_AUTHORIZED/);
  await expect(db.query("update public.doctors set verification_status='verified' where id=$1",[doctorId])).rejects.toThrow(/permission denied/);
});
test("favorites are idempotent with insert-only grants and remain private to their owner",async()=>{
  await testIdentity(db,patientA);
  for(let i=0;i<2;i++)await db.query("insert into public.favorites(patient_id,doctor_id) values($1,$2) on conflict(patient_id,doctor_id) do nothing",[patientA,doctorId]);
  expect((await db.query("select * from public.favorites")).rows).toHaveLength(1);
  await expect(db.query("update public.favorites set doctor_id=$1 where patient_id=$2",[doctorId,patientA])).rejects.toThrow(/permission denied/);
  await testIdentity(db,patientB);expect((await db.query("select * from public.favorites")).rows).toHaveLength(0);
  await db.query("delete from public.favorites where patient_id=$1",[patientA]);
  await testIdentity(db,patientA);expect((await db.query("select * from public.favorites")).rows).toHaveLength(1);
});
test("booking snapshots server price, is idempotent, and blocks a competing patient",async()=>{
  await testIdentity(db,patientA);const key=crypto.randomUUID();
  const first=await db.query<{result:typeof appointment}>("select public.book_appointment($1,$2,'Fictional visitor','01012345678') result",[slot,key]);
  appointment=first.rows[0].result;
  expect(Number(appointment.fee_snapshot)).toBe(450);expect(appointment.reference).toMatch(/^MD-[A-F0-9]{12}$/);
  const duplicate=await db.query<{result:typeof appointment}>("select public.book_appointment($1,$2,'Fictional visitor','01012345678') result",[slot,key]);
  expect(duplicate.rows[0].result.id).toBe(appointment.id);
  await expect(db.query("select public.book_appointment($1,$2,'Changed name','01012345678')",[slot,key])).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
  await testIdentity(db,patientB);
  await expect(db.query("select public.book_appointment($1,$2,'Second fictional visitor','01012345678')",[slot,crypto.randomUUID()])).rejects.toThrow(/INVALID_SLOT|SLOT_CONFLICT/);
  expect((await db.query("select * from public.appointments")).rows).toHaveLength(0);
  await expect(db.query("select public.change_appointment($1,'cancel',null)",[appointment.id])).rejects.toThrow(/NOT_AUTHORIZED/);
});
test("owner reschedules atomically, cancels, releases slot and gets notifications",async()=>{
  await testIdentity(db,patientA);
  await db.query("select public.change_appointment($1,'reschedule',$2)",[appointment.id,otherSlot]);
  const current=await db.query<{slot_id:string}>("select slot_id from public.appointments where id=$1",[appointment.id]);
  expect(current.rows[0].slot_id).toBe(otherSlot);
  await db.query("select public.change_appointment($1,'cancel',null)",[appointment.id]);
  await db.query("select public.change_appointment($1,'cancel',null)",[appointment.id]);
  expect((await db.query("select * from public.notifications")).rows).toHaveLength(3);
  await expect(db.query("select public.change_appointment($1,'reschedule',$2)",[appointment.id,slot])).rejects.toThrow(/INVALID_TRANSITION/);
  await testIdentity(db,patientB);
  expect((await db.query("select public.book_appointment($1,$2,'Second fictional visitor','01012345678')",[otherSlot,crypto.randomUUID()])).rows).toHaveLength(1);
});
test("doctor ownership, separate verification, and secure account linking",async()=>{
  await testIdentity(db,doctorUser);
  expect((await db.query("update public.doctors set name='{\"ar\":\"اسم خيالي\",\"en\":\"Fictional name\"}' where id=$1 returning id",[doctorId])).rows).toHaveLength(1);
  expect((await db.query("update public.doctors set name='{\"ar\":\"غير مسموح\",\"en\":\"Not allowed\"}' where id<>$1 returning id",[doctorId])).rows).toHaveLength(0);
  await expect(db.query("select public.admin_write('doctors',$1,'{\"linked_user_id\":null}'::jsonb)",[doctorId])).rejects.toThrow(/NOT_AUTHORIZED/);
  await testIdentity(db,adminUser);
  await db.query("select public.admin_write('doctors',$1,'{\"status\":\"inactive\"}'::jsonb)",[doctorId]);
  await db.exec("reset role;set role anon");
  expect((await db.query("select id from public.doctors where id=$1",[doctorId])).rows).toHaveLength(0);
  await testIdentity(db,adminUser);
  await db.query("select public.admin_write('doctors',$1,'{\"status\":\"published\"}'::jsonb)",[doctorId]);
  expect((await db.query("select * from public.audit_events")).rows.length).toBeGreaterThan(0);
});
test("shared request limits are atomic and inaccessible to public clients",async()=>{
  await db.exec("reset role;set role service_role");
  const args=["test-subject","test",2,3600];
  await db.query("select public.consume_request_limit($1,$2,$3,$4)",args);
  await db.query("select public.consume_request_limit($1,$2,$3,$4)",args);
  await expect(db.query("select public.consume_request_limit($1,$2,$3,$4)",args)).rejects.toThrow(/RATE_LIMIT/);
  await testIdentity(db,patientA);
  await expect(db.query("select * from public.ai_usage_counters")).rejects.toThrow(/permission denied/);
  await expect(db.query("select public.consume_request_limit($1,$2,$3,$4)",args)).rejects.toThrow(/permission denied/);
});
test("database matching validates actual clinic filters, specialty and pagination",async()=>{
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon");
  const result=await db.query<{result:{total:number;items:{doctorId:string}[]}}>("select public.search_doctors($1,'','price',1,1,'ar') result",[JSON.stringify({specialty:"dermatology",governorate:"alexandria",maxFee:500})]);
  expect(result.rows[0].result.total).toBe(1);expect(result.rows[0].result.items[0].doctorId).toBe("55555555-5555-4555-8555-000000000010");
  const none=await db.query<{result:{total:number}}>("select public.search_doctors($1) result",[JSON.stringify({maxFee:10})]);expect(none.rows[0].result.total).toBe(0);
});
test("revoked sessions lose access even while an old JWT subject remains",async()=>{
  await testIdentity(db,patientB);
  await db.exec("reset role");await db.query("delete from auth.sessions where user_id=$1",[patientB]);await db.exec("set role authenticated");
  expect((await db.query("select * from public.appointments")).rows).toHaveLength(0);
  await expect(db.query("select public.book_appointment($1,$2,'Fictional visitor','01012345678')",[slot,crypto.randomUUID()])).rejects.toThrow(/NOT_AUTHORIZED/);
});
