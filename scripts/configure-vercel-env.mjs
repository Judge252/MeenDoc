// Explicitly scoped deployment helper. Secret values travel through stdin only.
import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
const cli=process.argv[2];
if(!cli)throw new Error('Pass the verified Vercel CLI JavaScript path.');
const target={projectId:'prj_70i615YEtWUoh73niKmLoPcNKGo7',orgId:'team_JkMVXzABIkxw16PkKKUvZJSh',scope:'judge252s-projects'};
const link=JSON.parse(await fs.readFile('.vercel/project.json','utf8'));
if(link.projectId!==target.projectId||link.orgId!==target.orgId)throw new Error('Vercel link does not match the authorized MEENDOC project.');
const local=parseEnv(await fs.readFile('.env','utf8'));
if(local.NEXT_PUBLIC_SUPABASE_URL!=='https://mofdzltldjwkalvkkbvk.supabase.co')throw new Error('Unexpected Supabase project.');
const privatePath='.meendoc-test-vercel-secrets.private.json';
let secrets;
try{secrets=JSON.parse(await fs.readFile(privatePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;secrets={RATE_LIMIT_SECRET:randomBytes(48).toString('hex'),CRON_SECRET:randomBytes(48).toString('hex')};await fs.writeFile(privatePath,JSON.stringify(secrets),{flag:'wx',mode:0o600});}
const values={APP_MODE:'demo',DEMO_SAFE_MODE:'true',NEXT_PUBLIC_APP_URL:'https://meendoc.vercel.app',NEXT_PUBLIC_SUPABASE_URL:local.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ...(local.SUPABASE_SECRET_KEY?{SUPABASE_SECRET_KEY:local.SUPABASE_SECRET_KEY}:{SUPABASE_SERVICE_ROLE_KEY:local.SUPABASE_SERVICE_ROLE_KEY}),
  GEMINI_API_KEY:local.GEMINI_API_KEY,GEMINI_MODEL:local.GEMINI_MODEL||'gemini-3.5-flash-lite',LIVE_AI_ENABLED:'true',GEMINI_TIMEOUT_MS:'30000',GEMINI_MAX_ATTEMPTS:'1',AI_REQUEST_LIMIT_PER_HOUR:'20',AI_DAILY_USAGE_LIMIT:'200',AI_MAX_OUTPUT_TOKENS:'700',AI_MAX_HISTORY_MESSAGES:'12',AI_MAX_CONTEXT_CHARACTERS:'12000',BOOKING_WINDOW_DAYS:'14',...secrets};
const privateNames=new Set(['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','RATE_LIMIT_SECRET','CRON_SECRET']);
const redact=output=>Object.entries(values).reduce((text,[key,value])=>privateNames.has(key)&&value?text.split(value).join('[redacted]'):text,output);
for(const [name,value] of Object.entries(values)){
  if(!value)throw new Error('Missing required configuration: '+name);
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,'env','add',name,'production','--scope',target.scope,'--project',target.projectId,'--type',privateNames.has(name)?'secret':'config','--yes','--non-interactive'],{stdio:['pipe','pipe','pipe']});
    let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(redact(output))));child.stdin.end(value);
  });
  console.log(JSON.stringify({name,target:'production',type:privateNames.has(name)?'secret':'config',configured:true}));
}
