import "server-only";
import { z } from "zod";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { configuration,databaseConfigured,privilegedKey } from "./config";
import { ApiError,body,databaseError,sameOrigin,unavailable } from "./http";
import { serverClient } from "@/lib/supabase/server";
import { authorize } from "./auth/authorize";
import { directory,locations,loadDoctor,availableSlots } from "./repositories/catalog";
import { matchDoctors } from "./services/matching";
import { authAction } from "./services/authentication";
import { me,updateMe,favorites,notifications,privacyRequest } from "./services/accounts";
import { listAppointments,bookAppointment,changeAppointment } from "./services/booking";
import { submitApplication,listApplications,reviewApplication,feedback } from "./services/applications";
import { providerProfiles,providerClinics,availability,saveAvailability,saveDoctor } from "./services/providers";
import { adminOverview,adminRows,adminWrite,editDirectory,editClinic,linkClinic,providerAccounts } from "./services/administration";
import { assistantMessage } from "./ai/orchestrator";
import { messageSchema } from "./ai/contracts";
import { preferencesSchema,searchSchema,identifier,uuid,bookingSchema,profileSchema,applicationSchema,doctorEditSchema,scheduleSchema,exceptionSchema,reviewSchema,directoryEditSchema,announcementSchema,clinicSchema,feedbackSchema } from "@/lib/validation/schemas";
import type { Preferences } from "@/types";
export async function route(request:Request,parts:string[]){
  const path=parts.join("/"),method=request.method,c=configuration(),url=new URL(request.url);
  sameOrigin(request);
  if(path==="health"&&method==="GET"){
    const configured=databaseConfigured();let ready=false;
    if(configured&&c.APP_MODE==="demo")try{const r=await (await serverClient()).from("specialties").select("id").limit(1);ready=!r.error;}catch{}
    return {mode:c.APP_MODE,safe:true,database:{configured,ready},auth:configured&&privilegedKey()?"configured":"unconfigured",ai:c.APP_MODE==="offline"||!c.LIVE_AI_ENABLED?"scripted":c.GEMINI_API_KEY&&ready&&privilegedKey()?"live":"unavailable",email:"unconfigured"};
  }
  if(c.APP_MODE==="offline")throw new ApiError(503,"OFFLINE_MODE","This endpoint is unavailable in the explicitly simulated offline mode.");
  if(!databaseConfigured())throw unavailable();
  if(path==="internal/slots/refresh"&&method==="GET"){
    const supplied=request.headers.get("authorization")||"",expected="Bearer "+(c.CRON_SECRET||"");
    if(!c.CRON_SECRET||Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))throw new ApiError(401,"AUTH_REQUIRED","A scheduler credential is required.");
    const r=await adminClient().rpc("generate_appointment_slots",{p_days:c.BOOKING_WINDOW_DAYS,p_association:null});databaseError(r.error);return {generated:r.data,windowDays:c.BOOKING_WINDOW_DAYS};
  }
  if(parts[0]==="auth"&&method==="POST")return authAction(request,parts[1]);
  if(path==="specialties"&&method==="GET")return directory();
  if(path==="locations"&&method==="GET")return locations();
  if(path==="announcements"&&method==="GET"){
    const r=await (await serverClient()).from("announcements").select("id,content").eq("active",true).order("created_at",{ascending:false});databaseError(r.error);return r.data||[];
  }
  if(path==="doctors"&&method==="GET"){
    const values=Object.fromEntries(url.searchParams),allowed=Object.fromEntries(Object.entries(values).filter(([key])=>!["q","sort","page","pageSize","lang"].includes(key)));
    const preferences=preferencesSchema.parse(allowed) as Preferences,search=searchSchema.parse(values);
    return matchDoctors(preferences,search);
  }
  if(parts[0]==="doctors"&&parts[1]&&method==="GET"){
    const id=identifier.parse(parts[1]),doctor=await loadDoctor(id);
    return parts[2]==="availability"?availableSlots(doctor.id,url.searchParams.has("clinicId")?uuid.parse(url.searchParams.get("clinicId")):undefined):doctor;
  }
  if(path==="assistant/message"&&method==="POST")return assistantMessage(request,await body(request,messageSchema));
  if(path==="doctor-applications"&&method==="POST")return submitApplication(request,await body(request,applicationSchema));
  if(path==="feedback"&&method==="POST")return feedback(request,await body(request,feedbackSchema));
  if(path==="me"){if(method==="GET")return me();if(method==="PATCH")return updateMe(await body(request,profileSchema));}
  if(path==="privacy/request"&&method==="POST"){await body(request,z.strictObject({}));return privacyRequest();}
  if(path==="favorites"){
    if(method==="GET")return favorites(method);
    if(["POST","DELETE"].includes(method)){const value=await body(request,z.strictObject({doctorId:uuid}));return favorites(method,value.doctorId);}
  }
  if(path==="notifications"){
    if(method==="GET")return notifications();
    if(method==="PATCH")return notifications((await body(request,z.strictObject({id:uuid}))).id);
  }
  if(path==="appointments"){
    if(method==="GET")return listAppointments();
    if(method==="POST")return bookAppointment(await body(request,bookingSchema));
  }
  if(parts[0]==="appointments"&&parts[1]){
    const id=uuid.parse(parts[1]);
    if(method==="GET"){const own=(await listAppointments()).find(a=>a.recordId===id);if(!own)throw new ApiError(404,"NOT_FOUND","This appointment is not available.");return own;}
    if(method==="POST"&&parts[2]==="cancel"){await body(request,z.strictObject({}));return changeAppointment(id,"cancel");}
    if(method==="POST"&&parts[2]==="reschedule")return changeAppointment(id,"reschedule",(await body(request,z.strictObject({slotId:uuid}))).slotId);
  }
  if(parts[0]==="doctor"){
    await authorize("doctor");
    if(parts[1]==="profile"){if(method==="GET")return providerProfiles();if(method==="PATCH")return saveDoctor(await body(request,doctorEditSchema));}
    if(parts[1]==="applications"&&method==="GET")return listApplications();
    if(parts[1]==="clinics"){
      if(method==="GET")return providerClinics();
      if(method==="PATCH"){
        const v=await body(request,z.strictObject({id:uuid,name:clinicSchema.shape.name.optional(),address:clinicSchema.shape.address.optional(),active:z.boolean().optional()})),{db}=await authorize("doctor");
        const {id,...fields}=v,r=await db.from("clinics").update(fields).eq("id",id).select("id").maybeSingle();databaseError(r.error);if(!r.data)throw new ApiError(403,"FORBIDDEN","This clinic is shared or not owned by your provider account.");return providerClinics();
      }
    }
    if(parts[1]==="availability"){
      if(method==="GET")return availability();
      if(method==="POST")return saveAvailability(await body(request,scheduleSchema));
      if(method==="PATCH")return saveAvailability(await body(request,exceptionSchema),true);
      if(method==="DELETE"){
        const v=await body(request,z.strictObject({id:uuid,doctorClinicId:uuid})),{db}=await authorize("doctor");
        const r=await db.from("availability_rules").delete().eq("id",v.id).eq("doctor_clinic_id",v.doctorClinicId);databaseError(r.error);
        const generated=await db.rpc("generate_appointment_slots",{p_days:c.BOOKING_WINDOW_DAYS,p_association:v.doctorClinicId});databaseError(generated.error);return availability();
      }
    }
    if(parts[1]==="appointments"){if(method==="GET")return listAppointments("doctor");if(method==="PATCH"){const v=await body(request,z.strictObject({id:uuid,status:z.enum(["cancelled","completed"])}));return changeAppointment(v.id,v.status==="cancelled"?"cancel":"complete");}}
  }
  if(parts[0]==="admin"){
    await authorize("admin");const action=parts[1];
    if(action==="overview"&&method==="GET")return adminOverview();
    if(action==="accounts"&&method==="GET")return providerAccounts();
    if(action==="applications"){if(method==="GET")return listApplications(true);if(method==="PATCH")return reviewApplication(await body(request,reviewSchema));}
    if(action==="doctors"){if(method==="GET")return providerProfiles(true);if(["POST","PATCH"].includes(method))return saveDoctor(await body(request,doctorEditSchema),true);}
    if(action==="specialties"){if(method==="GET")return directory();if(["POST","PATCH"].includes(method))return editDirectory(await body(request,directoryEditSchema));}
    if(action==="clinics"){if(method==="GET")return adminRows("clinics");if(method==="POST")return editClinic(await body(request,clinicSchema));if(method==="PATCH"){const v=await body(request,z.strictObject({id:uuid,name:clinicSchema.shape.name.optional(),address:clinicSchema.shape.address.optional(),active:z.boolean().optional()})),{id,...data}=v;return adminWrite("clinics",id,data);}}
    if(action==="doctor-clinics"&&method==="POST")return linkClinic(await body(request,z.strictObject({doctorId:uuid,clinicId:uuid,fee:z.number().min(100).max(5000)})));
    if(action==="appointments"){if(method==="GET")return listAppointments("admin");if(method==="PATCH"){const v=await body(request,z.strictObject({id:uuid,status:z.enum(["cancelled","completed"])}));return changeAppointment(v.id,v.status==="cancelled"?"cancel":"complete");}}
    if(action==="announcements"){
      if(method==="GET")return adminRows("announcements");
      if(["POST","PATCH"].includes(method)){const v=await body(request,announcementSchema);return adminWrite("announcements",v.id,{content:v.content,active:v.active,starts_at:v.startsAt,ends_at:v.endsAt});}
    }
    if(action==="audit-events"&&method==="GET")return adminRows("audit_events",z.coerce.number().int().min(1).max(1000).parse(url.searchParams.get("page")||1));
    if(action==="feedback"){if(method==="GET")return adminRows("feedback");if(method==="PATCH"){const v=await body(request,z.strictObject({id:uuid,status:z.enum(["open","resolved"])}));return adminWrite("feedback",v.id,{status:v.status});}}
    if(action==="privacy-requests"){if(method==="GET")return adminRows("privacy_requests");if(method==="PATCH"){const v=await body(request,z.strictObject({id:uuid,status:z.enum(["reviewed","completed"])}));return adminWrite("privacy_requests",v.id,{status:v.status});}}
  }
  if(path==="assistant/reset"&&method==="POST"){(await cookies()).delete("md-chat");return {reset:true};}
  throw new ApiError(404,"NOT_FOUND","This endpoint is not available.");
}
