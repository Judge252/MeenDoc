import { test,expect,type Page } from "@playwright/test";
import { doctors as fixtures } from "../src/data/doctors";
import { demoDates } from "../src/lib/mock-service";
import { translate } from "../src/lib/i18n";
import type { Doctor,Appointment } from "../src/types";
import AxeBuilder from "@axe-core/playwright";
const doctorId="55555555-5555-4555-8555-000000000001",clinicId="66666666-6666-4666-8666-000000000001",associationId="77777777-7777-4777-8777-000000000001";
const slotId="88888888-8888-4888-8888-000000000001",recordId="99999999-9999-4999-8999-000000000001";
const text=(key:Parameters<typeof translate>[0])=>translate(key,"ar");
async function mockTechnicalApi(page:Page,failAi=false,variant?:"multiple-clinics"|"empty-slots"){
  // These are controlled contract fixtures. They do not verify Supabase/Gemini.
  const date=demoDates(1)[0];
  const doctor:Doctor={...fixtures[0],id:doctorId,slug:"doctor-1",status:"published",verificationStatus:"unverified",
    clinics:[{id:clinicId,doctorClinicId:associationId,name:{ar:"عيادة خيالية","en":"Fictional clinic"},address:{ar:"عنوان خيالي","en":"Fictional address"},governorate:"cairo",area:"maadi",fee:450,active:true}],
    availableSlots:[{id:slotId,doctorClinicId:associationId,clinicId,date,time:"16:00",startsAt:date+"T13:00:00Z",endsAt:date+"T13:30:00Z"}],slots:["16:00"]};
  if(variant==="multiple-clinics"){
    const secondClinic="66666666-6666-4666-8666-000000000002",secondDate=demoDates(2)[0];
    doctor.clinics!.push({...doctor.clinics![0],id:secondClinic,doctorClinicId:associationId.slice(0,-1)+"2",name:{ar:"عيادة ثانية خيالية",en:"Second fictional clinic"},fee:700});
    doctor.availableSlots!.push({...doctor.availableSlots![0],id:slotId.slice(0,-1)+"2",clinicId:secondClinic,doctorClinicId:associationId.slice(0,-1)+"2",date:secondDate,time:"18:00",startsAt:secondDate+"T15:00:00Z",endsAt:secondDate+"T15:30:00Z"});
    doctor.slots.push("18:00");
  }
  if(variant==="empty-slots"){doctor.availableSlots=[];doctor.slots=[];}
  const preferences={specialty:"ophthalmology",subspecialty:"all",governorate:"cairo",area:"all",maxFee:500,gender:"all",timing:"all",maxDays:30};
  let signedIn=false,bookings:Appointment[]=[],favorites:string[]=[];
  const calls:{path:string;method:string;data:Record<string,unknown>}[]=[];
  await page.route("**/api/**",async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method(),data=req.postDataJSON()||{};
    calls.push({path,method,data});
    let result:unknown;
    const failure=async(status:number,code:string)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify({error:{code,message:"Controlled API test failure."}})});
    if(path==="/api/health")result={mode:"demo",safe:true,database:{configured:true,ready:true},auth:"configured",ai:failAi?"unavailable":"live",email:"unconfigured"};
    else if(path==="/api/specialties")result={specialties:[{id:"11111111-1111-4111-8111-000000000004",slug:"ophthalmology",name:{ar:"عيون",en:"Ophthalmology"},active:true}],subspecialties:[]};
    else if(path==="/api/announcements")result=[];
    else if(path==="/api/me"){if(!signedIn)return failure(401,"AUTH_REQUIRED");result={user:{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",name:"زائر خيالي",phone:"01012345678",email:"controlled@example.test",roles:["patient"]},location:"cairo",language:"ar",reminders:false};}
    else if(path==="/api/auth/login"){signedIn=true;result={authenticated:true,confirmationRequired:false};}
    else if(path==="/api/auth/logout"){signedIn=false;result={signedOut:true};}
    else if(path==="/api/doctors")result={doctors:[doctor],total:1,page:1,pageSize:16,matchCriteria:preferences};
    else if(path==="/api/doctors/"+doctorId+"/availability")result=doctor.availableSlots;
    else if(path==="/api/doctors/"+doctorId)result=doctor;
    else if(path==="/api/assistant/message"){
      if(failAi&&data.action==="message")return failure(429,"AI_QUOTA_EXCEEDED");
      const urgent=data.scenario==="emergency";
      result={sessionId:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",mode:data.action==="scenario"?"scripted":"live",reply:urgent?"رسالة طوارئ تجريبية، اطلب مساعدة عاجلة لو فيه طوارئ فعلًا.":"نتائج قاعدة البيانات حسب اختياراتك، مش توصية طبية.",phase:urgent?"emergency":"results",preferences,doctors:urgent?[]:[doctor],safetyStatus:urgent?"emergency_demo":"navigation_only"};
    }else if(path==="/api/appointments"){
      if(!signedIn)return failure(401,"AUTH_REQUIRED");
      if(method==="POST"){bookings=[{id:"MD-ABCDEF123456",recordId,doctorId,clinicId,slotId,date,time:"16:00",clinic:"main",status:"confirmed",feeSnapshot:450,patient:data.patient as Appointment["patient"]}];result=bookings[0];}
      else result=bookings;
    }else if(path==="/api/appointments/"+recordId+"/cancel"){bookings=bookings.map(a=>({...a,status:"cancelled"}));result=bookings[0];}
    else if(path==="/api/favorites"){
      if(method==="POST")favorites=[String(data.doctorId)];if(method==="DELETE")favorites=[];result=favorites;
    }else if(path==="/api/notifications")result=[];
    else return failure(404,"NOT_FOUND");
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:result})});
  });
  return {calls,doctor};
}
test("mocked technical API: consent, real-auth UI, server booking reload and favorites",async({page})=>{
  const {calls}=await mockTechnicalApi(page);
  await page.goto("/");
  await page.locator("#message-input").fill("عايز دكتور عيون خيالي في القاهرة بحد أقصى ٥٠٠ جنيه.");
  await page.getByRole("button",{name:text("send"),exact:true}).click();
  const consent=page.getByRole("dialog");await expect(consent).toContainText(text("aiConsent"));
  await consent.getByRole("checkbox").check();await consent.getByRole("button",{name:text("aiConsentAccept"),exact:true}).click();
  await expect(page.locator(".chat-results .doctor-card")).toHaveCount(1);
  expect(calls.find(c=>c.path==="/api/assistant/message")?.data.consent).toEqual({adult:true,fictional:true,google:true,version:"meendoc-ai-v1"});
  await page.locator(".chat-results .doctor-name").click();
  await page.locator(".appointment-card").getByRole("link",{name:text("book"),exact:true}).click();
  await page.getByRole("button",{name:text("next"),exact:true}).click();await page.getByRole("button",{name:text("next"),exact:true}).click();
  await page.locator(".time-slots button").first().click();await page.getByRole("button",{name:text("next"),exact:true}).click();
  await page.getByRole("button",{name:text("login"),exact:true}).click();
  const auth=page.getByRole("dialog");await expect(auth.getByRole("button",{name:text("demoSignIn"),exact:true})).toHaveCount(0);
  await auth.getByLabel(text("email"),{exact:true}).fill("controlled@example.test");await auth.getByLabel(text("password"),{exact:true}).fill("fictional-test-password");
  await auth.getByRole("button",{name:text("login"),exact:true}).click();
  await page.getByRole("button",{name:text("next"),exact:true}).click();await page.getByRole("button",{name:text("confirmBooking"),exact:true}).click();
  await expect(page.getByRole("heading",{name:text("bookedTitle"),exact:true})).toBeVisible();
  const sent=calls.find(c=>c.path==="/api/appointments"&&c.method==="POST")!;
  expect(sent.data.slotId).toBe(slotId);expect(sent.data.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);expect(sent.data).not.toHaveProperty("fee");
  await page.getByRole("link",{name:text("viewAppointments"),exact:true}).click();await expect(page).toHaveURL(/\/appointments$/);await page.reload();
  await expect(page.locator(".appointment-item")).toHaveCount(1);await expect(page.locator(".appointment-item")).toContainText("MD-ABCDEF123456");
  await page.locator("header").getByRole("link",{name:text("doctors"),exact:true}).click();await page.locator(".doctor-card").getByRole("button",{name:new RegExp(text("favoriteAdd"))}).click();await expect(page.locator(".doctor-card").getByRole("button",{name:new RegExp(text("favoriteRemove"))})).toHaveAttribute("aria-pressed","true");await page.reload();
  await expect(page.locator(".doctor-card").getByRole("button",{name:new RegExp(text("favoriteRemove"))})).toHaveAttribute("aria-pressed","true");
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain("01012345678");
});
test("mocked technical API: quota failure is visible and scripted emergency stops matching",async({page})=>{
  await mockTechnicalApi(page,true);await page.goto("/");
  await page.locator("#message-input").fill("Find a fictional doctor.");await page.getByRole("button",{name:text("send"),exact:true}).click();
  const dialog=page.getByRole("dialog");await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:text("aiConsentAccept"),exact:true}).click();
  await expect(page.locator(".chat-results")).toHaveCount(0);
  await expect(page.locator(".toast")).toContainText(text("aiUnavailable"));
  await page.getByRole("button",{name:text("scriptedMode"),exact:true}).click();await page.getByRole("button",{name:text("scenarioEmergency"),exact:true}).click();
  await expect(page.locator(".emergency-panel")).toBeVisible();await expect(page.locator("#message-input")).toBeDisabled();await expect(page.locator(".doctor-section")).toHaveCount(0);
});

test("mocked technical API: selected clinic preserves its fee, date and slot into booking",async({page})=>{
  const {doctor}=await mockTechnicalApi(page,false,"multiple-clinics");
  await page.goto("/doctors/"+doctorId);
  await page.locator(".appointment-card select").selectOption(doctor.clinics![1].id);
  await expect(page.locator(".booking-price strong")).toContainText("٧٠٠");
  await expect(page.locator(".time-slots button")).toHaveCount(1);
  await page.locator(".time-slots button").click();
  await page.locator(".appointment-card").getByRole("link",{name:text("book"),exact:true}).click();
  await expect(page).toHaveURL(new RegExp("clinicId="+doctor.clinics![1].id));
  const url=new URL(page.url());expect(url.searchParams.get("date")).toBe(doctor.availableSlots![1].date);expect(url.searchParams.get("time")).toBe("18:00");
  await expect(page.locator(".clinic-options button[aria-pressed=true]")).toContainText("عيادة ثانية خيالية");
  await expect(page.locator(".price-total strong")).toContainText("٧٠٠");
});

test("mocked technical API: empty availability keeps the form and shows validation",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await mockTechnicalApi(page,false,"empty-slots");await page.goto("/booking/"+doctorId);
  await expect(page.locator(".booking-summary")).toContainText(text("noAvailability"));
  await page.getByRole("button",{name:text("next"),exact:true}).click();
  await page.getByRole("button",{name:text("next"),exact:true}).click();
  await expect(page.locator(".booking-main .field-error")).toContainText(text("chooseDate"));
  await expect(page.locator(".booking-main")).toBeVisible();expect(errors).toEqual([]);
});

test("mocked technical API: bilingual responsive profiles and live-auth forms pass axe",async({page})=>{
  test.setTimeout(180000);
  await mockTechnicalApi(page);
  for(const lang of ["ar","en"] as const){
    await page.goto("/");if(lang==="en")await page.locator("header .language-btn").click();
    await expect(page.locator("html")).toHaveAttribute("dir",lang==="ar"?"rtl":"ltr");
    for(const width of [360,1440]){
      await page.setViewportSize({width,height:900});
      for(const path of ["/doctors/"+doctorId,"/booking/"+doctorId,"/register"]){
        await page.goto(path);await expect(page.locator("html")).toHaveAttribute("dir",lang==="ar"?"rtl":"ltr");
        await expect(page.getByRole("heading",{level:1})).toBeVisible();await expect(page.locator(".integration-status")).toContainText(translate("databaseDemo",lang));
        expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
        const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
        expect(results.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),path+" "+lang+" "+width).toEqual([]);
      }
    }
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto("/");await expect(page.getByRole("textbox",{name:translate("composer","en"),exact:true})).toBeVisible();await page.screenshot({path:"artifacts/qa/technical-mock-home-en-1440.png",fullPage:true});
});
