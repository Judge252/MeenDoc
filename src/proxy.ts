import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";
export async function proxy(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key||process.env.APP_MODE!=="demo")return NextResponse.next({request});
  let response=NextResponse.next({request});
  const secure=process.env.NEXT_PUBLIC_APP_URL?.startsWith("https:")===true;
  const db=createServerClient(url,key,{cookieOptions:{httpOnly:true,sameSite:"lax",secure,path:"/"},cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:values=>{values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,{...options,httpOnly:true,sameSite:"lax",secure}));},
  }});
  await db.auth.getUser();
  response.headers.set("Cache-Control","private, no-store");
  return response;
}
export const config={matcher:["/((?!_next/static|_next/image|images|fonts|icon.svg|favicon.ico).*)"]};
