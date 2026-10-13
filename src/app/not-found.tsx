"use client";
import { EmptyState } from "@/components/ui/primitives";
import { useApp } from "@/lib/app-context";
export default function NotFound(){const {t}=useApp();return <div className="container"><EmptyState title={t("notFound")} description={t("footerTagline")} action={t("returnHome")} href="/"/></div>;}
