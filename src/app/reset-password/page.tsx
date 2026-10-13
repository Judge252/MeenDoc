import { Suspense } from "react";
import { LiveAuthForm } from "@/components/auth/live-auth-form";
export default function ResetPasswordPage(){return <div className="auth-page"><Suspense><LiveAuthForm reset/></Suspense></div>;}
