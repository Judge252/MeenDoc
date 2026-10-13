import { Suspense } from "react";
import { Discovery } from "@/components/doctors/discovery";
import { Skeleton } from "@/components/ui/primitives";
export default function DoctorsPage(){return <Suspense fallback={<div className="container"><Skeleton/></div>}><Discovery/></Suspense>;}
