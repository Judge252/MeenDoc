import { NextResponse,type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { configuration } from "@/server/config";
import { safeNext } from "@/server/auth/authorize";
export const runtime="nodejs";
export async function GET(request:NextRequest){
  const token=request.nextUrl.searchParams.get("token_hash"),c=configuration();
  if(token){
    const db=await serverClient(),result=await db.auth.verifyOtp({token_hash:token,type:"email"});
    if(!result.error)return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("next")||undefined),c.NEXT_PUBLIC_APP_URL));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation",c.NEXT_PUBLIC_APP_URL));
}
