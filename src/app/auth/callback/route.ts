import { NextResponse,type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { serverClient } from "@/lib/supabase/server";
import { safeNext } from "@/server/auth/authorize";
import { configuration } from "@/server/config";
import { pseudonym } from "@/server/services/limits";
export const runtime="nodejs";
export async function GET(request:NextRequest){
  const c=configuration(),next=safeNext(request.nextUrl.searchParams.get("next")||undefined),code=request.nextUrl.searchParams.get("code");
  if(code){
    const db=await serverClient(),result=await db.auth.exchangeCodeForSession(code);
    if(!result.error&&result.data.user){
      if(next==="/reset-password"){
        const stamp=String(Date.now());
        (await cookies()).set("md-recovery",stamp+"."+pseudonym("recovery:"+result.data.user.id+":"+stamp),{httpOnly:true,sameSite:"lax",secure:c.NEXT_PUBLIC_APP_URL.startsWith("https:"),path:"/",maxAge:900});
      }
      return NextResponse.redirect(new URL(next,c.NEXT_PUBLIC_APP_URL));
    }
  }
  return NextResponse.redirect(new URL("/login?error=confirmation",c.NEXT_PUBLIC_APP_URL));
}
