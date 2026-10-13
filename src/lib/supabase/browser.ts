import { createClient } from "@supabase/supabase-js";
// Public catalog access only. Authentication goes through our HTTP-only cookie BFF.
export function publicBrowserClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
