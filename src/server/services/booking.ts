import "server-only";
import { authorize } from "../auth/authorize";
import { databaseError,ApiError } from "../http";
import { egyptParts } from "../repositories/catalog";
import type { Appointment } from "@/types";
type AppointmentRow={id:string;reference:string;doctor_id:string;clinic_id:string;slot_id:string;starts_at:string;ends_at:string;status:Appointment["status"];patient_name:string;patient_phone:string;fee_snapshot:number};
export function appointmentDto(row:AppointmentRow):Appointment{return {id:row.reference,recordId:row.id,doctorId:row.doctor_id,clinicId:row.clinic_id,slotId:row.slot_id,startsAt:row.starts_at,endsAt:row.ends_at,feeSnapshot:Number(row.fee_snapshot),...egyptParts(row.starts_at),clinic:"main",patient:{name:row.patient_name,phone:row.patient_phone},status:row.status};}
export async function listAppointments(role?:"doctor"|"admin"){
  const {db,user}=await authorize(role);let q=db.from("appointments").select("*").order("starts_at",{ascending:false}).limit(200);
  if(!role)q=q.eq("patient_id",user.id);
  const result=await q;databaseError(result.error);return (result.data||[]).map(r=>appointmentDto(r as AppointmentRow));
}
export async function bookAppointment(value:{slotId:string;idempotencyKey:string;patient:{name:string;phone:string}}){
  const {db}=await authorize();
  const result=await db.rpc("book_appointment",{p_slot:value.slotId,p_key:value.idempotencyKey,p_name:value.patient.name,p_phone:value.patient.phone});databaseError(result.error);
  return appointmentDto(result.data as AppointmentRow);
}
export async function changeAppointment(id:string,action:"cancel"|"reschedule"|"complete",slot?:string){
  const {db}=await authorize();const result=await db.rpc("change_appointment",{p_appointment:id,p_action:action,p_slot:slot||null});databaseError(result.error);
  if(!result.data)throw new ApiError(404,"APPOINTMENT_NOT_FOUND","The appointment is not available.");return appointmentDto(result.data as AppointmentRow);
}
