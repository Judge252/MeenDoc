import type { ReactNode } from "react";
import { protectedPage } from "@/server/auth/page-gate";
export const dynamic="force-dynamic";
export default async function AdminLayout({children}:{children:ReactNode}){return protectedPage("admin","/admin",children);}
