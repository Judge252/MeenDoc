import { migrationDatabase } from "./db-harness";
const db=await migrationDatabase();
const counts=await db.query("select (select count(*) from public.doctors) doctors,(select count(*) from public.specialties) specialties,(select count(*) from public.appointment_slots where status='available') slots");
console.log("Migrations and seed applied:",counts.rows);
await db.close();
