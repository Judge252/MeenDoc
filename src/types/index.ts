export type Language = "ar" | "en";
export type Localized = { ar: string; en: string };
export type Specialty = string;
export type Gender = "female" | "male";
export type Governorate = "cairo" | "giza" | "alexandria";
export interface Doctor {
  id: string; name: Localized; specialty: Specialty; subspecialty: Localized;
  governorate: Governorate; area: string; gender: Gender; fee: number;
  portrait: number; bio: Localized; services: Localized[];
  active: boolean; dayOffset: number; slots: string[];
  slug?:string; clinics?:Clinic[]; availableSlots?:AppointmentSlot[]; subspecialtySlug?:string;
  status?:"draft"|"published"|"inactive"; verificationStatus?:"unverified"|"verified"; linkedUserId?:string|null;
  credentials?:Localized[];experience?:Localized[];
}
export interface Preferences {
  specialty: Specialty | "all"; governorate: Governorate | "all";
  area: string; maxFee: number; gender: Gender | "all"; timing: "all" | "morning" | "evening";
  subspecialty: string; maxDays: number; date?:string;
}
export interface Patient { name: string; phone: string; id?:string; email?:string; roles?:("patient"|"doctor"|"admin")[] }
export interface Appointment {
  id: string; doctorId: string; date: string; time: string;
  clinic: "main" | "second"; patient: Patient;
  status: "confirmed" | "cancelled" | "completed";
  recordId?:string; slotId?:string; clinicId?:string; startsAt?:string; endsAt?:string; feeSnapshot?:number;
}
export interface DoctorApplication {
  id: string; name: string; specialty: Specialty; governorate: Governorate;
  area: string; registration: string; clinic: string; contact: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  linkedUserId?:string|null; doctorId?:string|null; notes?:string;
}
export interface Clinic { id:string; doctorClinicId:string; name:Localized; address:Localized; governorate:Governorate; area:string; fee:number; active:boolean }
export interface AppointmentSlot { id:string; doctorClinicId:string; clinicId:string; startsAt:string; endsAt:string; date:string; time:string }
export interface DirectoryItem {id:string;slug:string;name:Localized;active?:boolean;parentId?:string}
export interface Notification {id:string;category:string;content:Localized;readAt:string|null;createdAt:string}
export interface IntegrationStatus {mode:"offline"|"demo";safe:true;database:{configured:boolean;ready:boolean};auth:"configured"|"unconfigured";ai:"live"|"scripted"|"unavailable";email:"unconfigured"}
