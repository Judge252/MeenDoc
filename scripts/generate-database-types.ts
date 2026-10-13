import { migrationDatabase } from "./db-harness";
import { writeFile } from "node:fs/promises";
const db=await migrationDatabase(false);
const rows=await db.query<{table_name:string;column_name:string;udt_name:string;is_nullable:string;column_default:string|null}>("select table_name,column_name,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position");
const ts=(type:string)=>type==="jsonb"||type==="json"?"Json":["int2","int4","int8","float4","float8","numeric"].includes(type)?"number":type==="bool"?"boolean":"string";
const tables=new Map<string,typeof rows.rows>();
for(const row of rows.rows)tables.set(row.table_name,[...(tables.get(row.table_name)||[]),row]);
let out="// Generated from the MEENDOC migrations by scripts/generate-database-types.ts.\nexport type Json = string | number | boolean | null | { [key:string]:Json|undefined } | Json[];\nexport type Database={public:{Tables:{\n";
for(const [table,columns] of tables){
  out+=table+":{Row:{"+columns.map(c=>c.column_name+":"+ts(c.udt_name)+(c.is_nullable==="YES"?"|null":"")).join(";")+"};Insert:{"+columns.map(c=>c.column_name+(c.is_nullable==="YES"||c.column_default!==null?"?":"")+":"+ts(c.udt_name)+(c.is_nullable==="YES"?"|null":"")).join(";")+"};Update:{"+columns.map(c=>c.column_name+"?:"+ts(c.udt_name)+(c.is_nullable==="YES"?"|null":"")).join(";")+"};Relationships:[]};\n";
}
const functions=await db.query<{name:string;names:string[]|null;types:string[];defaults:number;result:string}>("select p.proname name,p.proargnames names,array(select format_type(t,null) from unnest(p.proargtypes) t) types,p.pronargdefaults defaults,format_type(p.prorettype,null) result from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname");
const pgType=(v:string)=>["integer","bigint","numeric","double precision"].includes(v)?"number":v==="boolean"?"boolean":v==="jsonb"||v==="json"?"Json":v==="void"?"undefined":"string";
out+="};Views:Record<string,never>;Functions:{\n";
for(const f of functions.rows)out+=f.name+":{Args:{"+f.types.map((t,i)=>(f.names?.[i]||"arg"+i)+(i>=f.types.length-f.defaults?"?":"")+":"+pgType(t)+(i>=f.types.length-f.defaults?"|null":"")).join(";")+"};Returns:"+pgType(f.result)+"};\n";
out+="};Enums:Record<string,never>;CompositeTypes:Record<string,never>}};\n";
await writeFile("src/types/database.ts",out);await db.close();console.log("Generated database types for "+tables.size+" tables and "+functions.rows.length+" functions.");
