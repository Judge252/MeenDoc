import { BookingFlow } from "@/components/booking/booking-flow";
export default async function BookingPage({params,searchParams}:{params:Promise<{doctorId:string}>;searchParams:Promise<{date?:string;time?:string;clinicId?:string}>}) {
  const {doctorId}=await params,{date,time,clinicId}=await searchParams;return <BookingFlow id={doctorId} initialDate={date} initialTime={time} initialClinicId={clinicId}/>;
}
