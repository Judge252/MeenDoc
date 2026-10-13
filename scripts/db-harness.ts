import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFile,readdir } from "node:fs/promises";
import path from "node:path";
// Test-only Supabase auth shim. This is NOT an authentication implementation.
export async function migrationDatabase(seed=true){
  const db=new PGlite({extensions:{btree_gist}});
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('request.jwt.claim.session_id',true))$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;");
  for(const file of (await readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort()){
    try{await db.exec(await readFile(path.join("supabase/migrations",file),"utf8"));}catch(error){await db.close();throw new Error(file+": "+(error instanceof Error?error.message:"Migration failed"));}
  }
  if(seed)await db.exec(await readFile("supabase/seed.sql","utf8"));
  return db;
}
export async function testIdentity(db:PGlite,id:string,role="authenticated"){
  const session="dddddddd-dddd-4ddd-8ddd-"+id.replaceAll("-","").slice(-12);
  await db.exec("reset role");
  await db.query("insert into auth.users(id) values($1) on conflict do nothing",[id]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2) on conflict do nothing",[session,id]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",[id,session]);
  await db.exec("set role "+role);
}
