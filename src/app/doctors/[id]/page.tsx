import { DoctorProfile } from "@/components/doctors/doctor-profile";
export default async function DoctorPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{from?:string}>}) {
  const {id}=await params,{from}=await searchParams;return <DoctorProfile id={id} matched={from==="assistant"}/>;
}
