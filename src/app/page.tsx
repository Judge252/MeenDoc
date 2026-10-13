"use client";
import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { ChatInterface } from "@/components/assistant/chat-interface";
import { DoctorCarousel } from "@/components/doctors/doctor-card";
import { PartnershipStrip } from "@/components/layout/app-shell";
export default function HomePage() {
  const {t,conversation}=useApp();
  return <div className="home-page container"><div className="ai-hero"><div className="hero-eyebrow"><Sparkles size={15}/>{t("heroEyebrow")}</div><h1>{t("welcome")}<span className="welcome-wave" aria-hidden="true">👋</span></h1><p>{t("heroDescription")}</p></div><ChatInterface/>{conversation.phase!=="emergency"&&<><div className="mobile-browse"><Link href="/doctors">{t("browseYourself")}<ArrowLeft size={16} className="directional"/></Link></div><DoctorCarousel/></>}<PartnershipStrip/></div>;
}
