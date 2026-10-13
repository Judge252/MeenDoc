import type { ReactNode } from "react";
import { protectedPage } from "@/server/auth/page-gate";
export const dynamic="force-dynamic";
export default async function DoctorLayout({children}:{children:ReactNode}){return protectedPage("doctor","/doctor/dashboard",children);}
