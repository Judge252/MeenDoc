"use client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/primitives";
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){const {t}=useApp();return <div className="container empty-state"><h1>{t("errorTitle")}</h1><Button onClick={reset}>{t("retry")}</Button></div>;}
