import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuration,privilegedKey } from "@/server/config";
import { unavailable } from "@/server/http";
export function adminClient(){
  const c=configuration(),key=privilegedKey();
  if(!key||!c.NEXT_PUBLIC_SUPABASE_URL)throw unavailable();
  return createClient(c.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
