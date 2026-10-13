import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
const privateValues=[];
for(const file of ['.env','.env.local']){try{const values=parseEnv(await fs.readFile(file,'utf8'));for(const [key,value] of Object.entries(values))if(!key.startsWith('NEXT_PUBLIC_')&&/(KEY|SECRET|TOKEN|PASSWORD)/.test(key)&&value.length>=16)privateValues.push(value);}catch(error){if(error.code!=='ENOENT')throw error;}}
try{const values=JSON.parse(await fs.readFile('.meendoc-test-vercel-secrets.private.json','utf8'));privateValues.push(...Object.values(values));}catch(error){if(error.code!=='ENOENT')throw error;}
const files=execFileSync('git',['diff','--cached','--name-only','-z']).toString().split('\0').filter(Boolean),hits=[];
for(const file of files){if((file.startsWith('.env')&&file!=='.env.example')||file.startsWith('.meendoc-test-')||file.startsWith('.vercel/')||file.includes('trace.zip')){hits.push(file);continue;}const content=execFileSync('git',['show',':'+file],{maxBuffer:40*1024*1024}).toString();if(privateValues.some(value=>content.includes(value)))hits.push(file);}
if(hits.length){console.error(JSON.stringify({status:'failed',files:hits}));process.exitCode=1;}else console.log(JSON.stringify({status:'passed',stagedFiles:files.length,secretMatches:0}));
