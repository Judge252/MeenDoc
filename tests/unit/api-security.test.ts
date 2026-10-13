import { beforeAll,afterAll,test,expect,vi } from "vitest";
const identity=vi.hoisted(()=>({signedIn:false}));
vi.mock("@/lib/supabase/server",()=>({serverClient:async()=>({
  auth:{getUser:async()=>({data:{user:identity.signedIn?{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",email:"fixture@example.test",user_metadata:{role:"admin"},app_metadata:{role:"admin"}}:null},error:null})},
  from:()=>({select:()=>({eq:async()=>({data:[{role:"patient"}],error:null})})}),
})}));
import { route } from "../../src/server/router";
import { respond,body } from "../../src/server/http";
import { z } from "zod";
beforeAll(()=>{vi.stubEnv("APP_MODE","demo");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://fictional-project.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","fictional-publishable-key");});
afterAll(()=>vi.unstubAllEnvs());
const guarded=["admin/overview","admin/applications","admin/doctors","admin/specialties","admin/clinics","admin/appointments","admin/announcements","admin/audit-events","admin/accounts","admin/feedback","admin/privacy-requests","doctor/profile","doctor/clinics","doctor/availability","doctor/appointments"];
for(const path of guarded){
  test("guest cannot read "+path,async()=>{
    identity.signedIn=false;const response=await respond(()=>route(new Request("http://127.0.0.1:3000/api/"+path),path.split("/")));
    expect(response.status).toBe(401);
  });
  test("patient metadata cannot elevate access to "+path,async()=>{
    identity.signedIn=true;const response=await respond(()=>route(new Request("http://127.0.0.1:3000/api/"+path,{method:"PATCH",headers:{Origin:"http://127.0.0.1:3000","Content-Type":"application/json"},body:"{}"}),path.split("/")));
    expect(response.status).toBe(403);
  });
}
test("cross-origin mutations and unbounded bodies are rejected before service calls",async()=>{
  const response=await respond(()=>route(new Request("http://127.0.0.1:3000/api/admin/doctors",{method:"POST",headers:{Origin:"https://untrusted.example","Content-Type":"application/json"},body:"{}"}),["admin","doctors"]));expect(response.status).toBe(403);
  await expect(body(new Request("http://127.0.0.1:3000",{method:"POST",body:JSON.stringify({text:"x".repeat(25000)})}),z.object({text:z.string()}))).rejects.toMatchObject({status:413});
});
test("catalog query bounds and unknown input fields cannot reach matching",async()=>{
  const response=await respond(()=>route(new Request("http://127.0.0.1:3000/api/doctors?pageSize=100000"),["doctors"]));expect(response.status).toBe(400);
  const unknown=await respond(()=>route(new Request("http://127.0.0.1:3000/api/doctors?role=admin"),["doctors"]));expect(unknown.status).toBe(400);
});
