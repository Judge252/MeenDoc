import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configuration,databaseConfigured } from "@/server/config";
import { unavailable } from "@/server/http";
export async function serverClient(){
  if(!databaseConfigured())throw unavailable();
  const c=configuration(),store=await cookies();
  return createServerClient(c.NEXT_PUBLIC_SUPABASE_URL!,c.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookieOptions:{httpOnly:true,sameSite:"lax",secure:new URL(c.NEXT_PUBLIC_APP_URL).protocol==="https:",path:"/"},
    cookies:{
      getAll:()=>store.getAll(),
      setAll:values=>{try{values.forEach(({name,value,options})=>store.set(name,value,{...options,httpOnly:true,sameSite:"lax",secure:new URL(c.NEXT_PUBLIC_APP_URL).protocol==="https:"}));}catch{/* Proxy/route handlers persist refreshed cookies; Server Components cannot set them. */}},
    },
    auth:{detectSessionInUrl:false},
  });
}
