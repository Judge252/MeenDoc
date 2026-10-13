import fs from 'node:fs/promises';
import path from 'node:path';
try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const privateKeys=['GEMINI_API_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','RATE_LIMIT_SECRET','CRON_SECRET','VERCEL_OIDC_TOKEN'];
const privateValues=privateKeys.map(key=>process.env[key]).filter(value=>value&&value.length>=16);
const files=[];
async function walk(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await walk(file);else files.push(file);}}
await walk('.next/static');
const hits=[];
for(const file of files){const content=await fs.readFile(file,'utf8');if(privateValues.some(value=>content.includes(value))||/sb_secret_[A-Za-z0-9_-]{20,}|AIzaSy[A-Za-z0-9_-]{30,}/.test(content))hits.push(file);}
if(hits.length){console.error(JSON.stringify({status:'failed',files:hits}));process.exitCode=1;}
else console.log(JSON.stringify({status:'passed',clientFiles:files.length,configuredPrivateValues:privateValues.length,secretMatches:0}));
