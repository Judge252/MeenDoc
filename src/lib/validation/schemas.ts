import { z } from "zod";
export const specialty=z.string().regex(/^[a-z][a-z0-9-]{1,70}$/);
export const governorate=z.enum(["cairo","giza","alexandria"]);
export const area=z.enum(["all","maadi","nasr","newcairo","dokki","mohandessin","smouha","sidi"]);
export const identifier=z.string().regex(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|doctor-(?:[1-9]|1[0-6]))$/i);
export const uuid=z.uuid();
export const localized=z.strictObject({ar:z.string().trim().min(2).max(1500),en:z.string().trim().min(2).max(1500)});
export const preferencesSchema=z.strictObject({
  specialty:specialty.or(z.literal("all")).default("all"),
  subspecialty:z.string().regex(/^(?:all|[a-z][a-z0-9-]{1,70})$/).default("all"),
  governorate:governorate.or(z.literal("all")).default("all"),
  area:z.string().regex(/^(?:all|[a-zA-Z][a-zA-Z0-9-]{1,70})$/).default("all"),
  maxFee:z.coerce.number().min(0).max(5000).default(2000),
  gender:z.enum(["all","female","male"]).default("all"),
  timing:z.enum(["all","morning","evening"]).default("all"),
  maxDays:z.coerce.number().int().min(1).max(30).default(30),
  date:z.iso.date().optional(),
});
export const searchSchema=z.object({q:z.string().trim().max(100).default(""),sort:z.enum(["availability","price","name"]).default("availability"),lang:z.enum(["ar","en"]).default("ar"),page:z.coerce.number().int().min(1).max(1000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(16)});
export const patientSchema=z.strictObject({name:z.string().trim().min(2).max(80),phone:z.string().regex(/^01[0125][0-9]{8}$/)});
export const bookingSchema=z.strictObject({slotId:uuid,idempotencyKey:uuid,patient:patientSchema});
export const applicationSchema=z.strictObject({
  name:z.string().trim().min(2).max(80),specialty,governorate,area:z.string().trim().min(2).max(80),
  registration:z.string().trim().min(3).max(120),clinic:z.string().trim().min(3).max(500),
  contact:z.email().max(160),adultConsent:z.literal(true),demoConsent:z.literal(true),
});
export const doctorEditSchema=z.strictObject({
  id:uuid.optional(),name:localized.optional(),bio:localized.optional(),specialty:specialty.optional(),
  gender:z.enum(["female","male"]).optional(),fee:z.number().min(100).max(5000).optional(),
  governorate:governorate.optional(),area:z.string().max(70).optional(),
  status:z.enum(["draft","published","inactive"]).optional(),verificationStatus:z.enum(["unverified","verified"]).optional(),
  linkedUserId:uuid.nullable().optional(),credentials:z.array(localized).max(10).optional(),experience:z.array(localized).max(10).optional(),
});
export const scheduleSchema=z.strictObject({
  doctorClinicId:uuid,dayOfWeek:z.number().int().min(0).max(6),startTime:z.string().regex(/^\d{2}:\d{2}$/),
  endTime:z.string().regex(/^\d{2}:\d{2}$/),duration:z.number().int().min(15).max(120),
}).refine(v=>v.startTime<v.endTime);
export const exceptionSchema=z.strictObject({doctorClinicId:uuid,date:z.iso.date(),unavailable:z.boolean().default(true),startTime:z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),endTime:z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),reason:z.string().max(120).default("Demo schedule exception")});
export const authSchema=z.strictObject({email:z.email().max(160),password:z.string().min(8).max(72),name:z.string().trim().min(2).max(80).optional(),next:z.string().max(300).optional(),adultConsent:z.boolean().optional()});
export const profileSchema=z.strictObject({name:z.string().trim().min(2).max(80).optional(),phone:z.string().regex(/^01[0125][0-9]{8}$/).optional(),language:z.enum(["ar","en"]).optional(),location:governorate.or(z.literal("all")).optional(),reminders:z.boolean().optional()});
export const clinicSchema=z.strictObject({id:uuid.optional(),name:localized,address:localized,governorate,city:z.string().max(70),active:z.boolean().default(true)});
export const reviewSchema=z.strictObject({id:uuid,status:z.enum(["under_review","approved","rejected"]),notes:z.string().max(1000).default(""),linkedUserId:uuid.nullable().default(null),doctorId:uuid.nullable().default(null)});
export const directoryEditSchema=z.strictObject({id:uuid.optional(),slug:z.string().regex(/^[a-z][a-z0-9-]{1,70}$/),name:localized,active:z.boolean(),parentId:uuid.optional()});
export const announcementSchema=z.strictObject({id:uuid.optional(),content:localized,active:z.boolean().default(true),startsAt:z.iso.datetime().nullable().default(null),endsAt:z.iso.datetime().nullable().default(null)});
export const feedbackSchema=z.strictObject({category:z.enum(["usability","catalog","technical"]),rating:z.number().int().min(1).max(5),text:z.string().trim().max(600).default(""),demoConsent:z.literal(true)});
