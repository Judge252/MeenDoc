import type { Metadata } from "next";
import { AppProvider } from "@/lib/app-context";
import { Shell } from "@/components/layout/app-shell";
import "./globals.css";
export const metadata: Metadata = {title:{default:"MEENDOC | ميندوك — بداية أوضح",template:"%s | MEENDOC"},description:"ميندوك — تجربة تفاعلية للتوجيه الصحي واكتشاف الدكاترة. ملفات وحجوزات خيالية فقط."};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ar-EG" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning><body><AppProvider><Shell>{children}</Shell></AppProvider></body></html>;
}
