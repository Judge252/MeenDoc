import env from "@next/env";
import { createClient } from "@supabase/supabase-js";
env.loadEnvConfig(process.cwd());
const email=process.argv[2];
if(!email||!email.includes("@"))throw new Error("Usage: npm run admin:bootstrap -- confirmed-account-email");
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Configure server-only Supabase credentials first.");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let userId:string|undefined;
for(let page=1;page<=20&&!userId;page++){
  const r=await db.auth.admin.listUsers({page,perPage:100});if(r.error)throw new Error("Account lookup failed.");
  const user=r.data.users.find(u=>u.email?.toLowerCase()===email.toLowerCase()&&u.email_confirmed_at);
  userId=user?.id;if(r.data.users.length<100)break;
}
if(!userId)throw new Error("Create and confirm this demo account before assigning an admin role.");
const role=await db.from("user_roles").upsert({user_id:userId,role:"admin"},{onConflict:"user_id,role"});if(role.error)throw new Error("Admin role assignment failed.");
const audit=await db.from("audit_events").insert({actor_id:userId,action:"admin.bootstrap",target_entity:"user_roles",target_id:userId});if(audit.error)throw new Error("Role assigned, but audit creation failed. Inspect the development project.");
console.log("Admin role assigned to the existing confirmed demo account. No credentials were printed.");
