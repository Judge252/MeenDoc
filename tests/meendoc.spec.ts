import { test, expect, type Page } from "@playwright/test";
import { translate, type CopyKey } from "../src/lib/i18n";
import { newConversation, transition } from "../src/lib/conversation-engine";
import { emptyPreferences, filterDoctors, formatTime } from "../src/lib/mock-service";
import { doctors } from "../src/data/doctors";
import type { Language } from "../src/types";
import fs from "node:fs";

const text=(key:CopyKey,language:Language="ar")=>translate(key,language);
async function setLanguage(page:Page,language:Language) {
  await expect(page.locator("html")).toHaveAttribute("lang",/ar-EG|en/);
  if(await page.locator("html").getAttribute("dir")!==(language==="ar"?"rtl":"ltr"))await page.locator("header").getByRole("button",{name:/تغيير اللغة|Change language/}).click();
  await expect(page.locator("html")).toHaveAttribute("dir",language==="ar"?"rtl":"ltr");
}
const button=(page:Page,key:CopyKey,lang:Language="ar")=>page.getByRole("button",{name:text(key,lang),exact:true});

test("scripted engine never assigns a specialty to unrecognized free text",()=>{
  const state=transition(newConversation(),{type:"free",text:"A real concern that is not a demo"});
  expect(state.phase).toBe("uncertain");expect(state.specialty).toBe("all");
  const urgent=transition(newConversation(),{type:"scenario",scenario:"emergency"});
  expect(urgent.phase).toBe("emergency");expect(urgent.messages.at(-1)?.key).toBe("emergencyMessage");
  expect(transition(urgent,{type:"preferences",preferences:emptyPreferences}).phase).toBe("emergency");
});
test("matching uses every selected catalog field and does not invent profiles",()=>{
  const matches=filterDoctors(doctors,{...emptyPreferences,specialty:"ophthalmology",governorate:"cairo",area:"maadi",maxFee:500,gender:"female",timing:"evening",maxDays:1,subspecialty:"ophthalmology"});
  expect(matches.map(d=>d.id)).toEqual(["doctor-1"]);
  expect(filterDoctors(doctors,{...emptyPreferences,specialty:"ophthalmology",maxFee:100})).toEqual([]);
  expect(filterDoctors(doctors.map(d=>({...d,active:false})),emptyPreferences)).toEqual([]);
});

for(const lang of ["ar","en"] as const) {
  test("complete patient journey, validation, rescheduling and cancellation — "+lang,async({page,baseURL})=>{
    const errors:string[]=[],external:string[]=[];
    const testOrigin=new URL(baseURL!).origin;
    page.on("pageerror",e=>errors.push(e.message));
    page.on("request",request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==testOrigin)external.push(request.url());});
    await page.goto("/");await setLanguage(page,lang);
    await button(page,"starterSpecialty",lang).click();
    await button(page,"scenarioEyes",lang).click();
    await button(page,"days",lang).click();
    await button(page,"routine",lang).click();
    await expect(page.getByRole("heading",{name:text("preferencesTitle",lang)})).toBeVisible();
    await page.getByRole("combobox",{name:text("governorate",lang),exact:true}).selectOption("cairo");
    await page.getByRole("combobox",{name:text("budget",lang),exact:true}).selectOption("500");
    await button(page,"showMatches",lang).click();
    const card=page.locator(".chat-results .doctor-card");
    await expect(card).toHaveCount(1);
    await card.getByRole("button",{name:new RegExp(text("favoriteAdd",lang))}).click();
    await card.locator(".doctor-name").click();
    await expect(page.getByRole("heading",{name:text("whyMatch",lang)})).toBeVisible();
    await page.locator(".appointment-card").getByRole("link",{name:text("book",lang)}).click();
    await button(page,"next",lang).click();await button(page,"next",lang).click();
    await page.locator(".time-slots button").first().click();
    await button(page,"next",lang).click();
    await expect(page.getByRole("heading",{name:text("bookingGate",lang)})).toBeVisible();
    await button(page,"login",lang).click();
    await page.getByRole("dialog").getByRole("button",{name:text("demoSignIn",lang)}).click();
    await page.getByLabel(text("patientName",lang),{exact:true}).fill("X");
    await button(page,"next",lang).click();await expect(page.locator(".field-error")).toContainText(text("nameError",lang));
    await page.getByLabel(text("patientName",lang),{exact:true}).fill(lang==="ar"?"زائر خيالي":"Fictional Visitor");
    await page.getByLabel(text("phone",lang),{exact:true}).fill("123");
    await button(page,"next",lang).click();await expect(page.locator(".field-error")).toContainText(text("phoneError",lang));
    await page.getByLabel(text("phone",lang),{exact:true}).fill(lang==="ar"?"٠١٠١٢٣٤٥٦٧٨":"01012345678");
    await button(page,"next",lang).click();await button(page,"confirmBooking",lang).click();
    await expect(page.getByRole("heading",{name:text("bookedTitle",lang)})).toBeVisible();
    await expect(page.locator(".reference strong")).toHaveText(/^MD-[A-F0-9]{8}$/);
    await page.getByRole("link",{name:text("viewAppointments",lang)}).click();
    await expect(page.locator(".appointment-item")).toHaveCount(1);
    await button(page,"reschedule",lang).click();
    await page.getByRole("dialog").locator(".date-buttons button").nth(1).click();
    await page.getByRole("dialog").locator(".time-slots button").first().click();
    await page.getByRole("dialog").getByRole("button",{name:text("save",lang),exact:true}).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await button(page,"cancelAppointment",lang).click();
    await page.getByRole("dialog").getByRole("button",{name:text("cancelAppointment",lang),exact:true}).click();
    await page.getByRole("tab",{name:text("cancelled",lang),exact:true}).click();
    await expect(page.locator(".appointment-item .status-pill")).toHaveText(text("cancelled",lang));
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("meendoc.demo.preferences.v1")||"{}"));
    expect(stored.favorites).toContain("doctor-1");
    expect(Object.keys(stored).sort()).toEqual(["favorites","lang","location","reminders"].sort());
    expect(JSON.stringify(stored)).not.toContain("01012345678");
    expect(errors).toEqual([]);expect(external).toEqual([]);
  });
}

test("emergency demo halts normal recommendations and free text stays uncertain",async({page})=>{
  await page.goto("/");
  await button(page,"starterSpecialty").click();await button(page,"scenarioEmergency").click();
  await expect(page.locator(".emergency-panel")).toContainText(text("emergencyStopped"));
  await expect(page.locator("#message-input")).toBeDisabled();await expect(page.locator(".doctor-section")).toHaveCount(0);
  await page.locator(".chat-toolbar").getByRole("button",{name:text("restart"),exact:true}).click();
  await page.locator("#message-input").fill("PRIVATE FICTIONAL SYMPTOM");
  await button(page,"send").click();
  await expect(page.locator(".notice-warning")).toContainText(text("uncertainTitle"));
  await expect(page.locator(".chat-results")).toHaveCount(0);
  const stored=await page.evaluate(()=>JSON.stringify(localStorage));
  expect(stored).not.toContain("PRIVATE FICTIONAL SYMPTOM");
});

test("voice is honest when on-device transcription is unavailable",async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,"SpeechRecognition",{value:undefined,configurable:true});Object.defineProperty(window,"webkitSpeechRecognition",{value:undefined,configurable:true});});
  await page.goto("/");await button(page,"voice").click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText(text("voicePrivacy"));await dialog.getByRole("button",{name:text("voicePermission")}).click();
  await expect(dialog.getByRole("status")).toHaveText(text("voiceUnsupported"));
  await dialog.getByRole("button",{name:text("starterSpecialty"),exact:true}).click();
  await expect(page.locator("#message-input")).toHaveValue(text("starterSpecialty"));
  await button(page,"send").click();await expect(button(page,"scenarioEyes")).toBeVisible();
});

test("discovery search, advanced filters, sort, comparison and favorite persistence",async({page})=>{
  await page.goto("/doctors");await expect(page.locator(".doctor-card")).toHaveCount(16);
  await page.getByLabel(text("search"),{exact:true}).fill("Nobody");
  await button(page,"searchAction").click();await expect(page.getByRole("heading",{name:text("noResults")})).toBeVisible();
  await button(page,"clearFilters").click();await expect(page.locator(".doctor-card")).toHaveCount(16);
  await button(page,"filters").click();const dialog=page.getByRole("dialog");
  await dialog.getByRole("combobox",{name:text("specialty"),exact:true}).selectOption("ophthalmology");
  await dialog.getByRole("combobox",{name:text("governorate"),exact:true}).selectOption("cairo");
  await dialog.getByRole("combobox",{name:text("budget"),exact:true}).selectOption("500");
  await dialog.getByRole("combobox",{name:text("availability"),exact:true}).selectOption("1");
  await dialog.getByRole("button",{name:text("applyFilters")}).click();
  await expect(page.locator(".doctor-card")).toHaveCount(1);await expect(page).toHaveURL(/days=1/);
  await button(page,"clearFilters").click();
  await page.getByRole("combobox",{name:text("sort"),exact:true}).selectOption("price");
  await expect(page.locator(".doctor-card").first()).toHaveAttribute("data-doctor-id",/doctor-(6|7|14)/);
  await page.locator(".doctor-card").nth(0).getByRole("button",{name:text("compare"),exact:true}).click();
  await page.locator(".doctor-card").nth(1).getByRole("button",{name:text("compare"),exact:true}).click();
  await page.locator(".compare-bar").getByRole("button",{name:text("compare"),exact:true}).click();
  await expect(page.getByRole("dialog").locator("thead th")).toHaveCount(3);
  await page.getByRole("dialog").getByRole("button",{name:text("close"),exact:true}).click();
  const firstId=await page.locator(".doctor-card").first().getAttribute("data-doctor-id");
  await page.locator(".doctor-card").first().getByRole("button",{name:new RegExp(text("favoriteAdd"))}).click();
  await page.reload();
  await expect(page.locator('.doctor-card[data-doctor-id="'+firstId+'"]').getByRole("button",{name:new RegExp(text("favoriteRemove"))})).toHaveAttribute("aria-pressed","true");
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem("meendoc.demo.preferences.v1")||"{}"));
  expect(data.favorites).toContain(firstId);
});

test("doctor enrollment remains pending and admin edits update the catalog",async({page})=>{
  await page.goto("/join-as-doctor");
  await page.locator("input[name=name]").fill("د. ملف خيالي");
  await page.locator("input[name=area]").fill("المعادي");
  await page.locator("input[name=registration]").fill("DEMO-ONLY-123");
  await page.locator("textarea[name=clinic]").fill("عيادة خيالية للتجربة");
  await page.locator("input[name=contact]").fill("example@example.test");
  await button(page,"submitInterest").click();
  await expect(page.locator(".application-success")).toContainText(text("pending"));
  await page.locator("footer").getByRole("link",{name:text("admin"),exact:true}).click();
  await button(page,"applications").click();
  const application=page.locator("tr").filter({hasText:"د. ملف خيالي"});
  await application.getByRole("button",{name:text("details"),exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:text("approve"),exact:true}).click();
  await expect(application.locator(".status-pill")).toHaveText(text("approved"));
  await button(page,"management").click();
  await page.locator(".admin-table tbody tr").first().getByRole("button",{name:text("edit"),exact:true}).click();
  await page.getByRole("dialog").getByLabel(text("fee"),{exact:true}).fill("480");
  await page.getByRole("dialog").getByRole("button",{name:text("save"),exact:true}).click();
  await expect(page.locator(".admin-table tbody tr").first()).toContainText("٤٨٠");
  await button(page,"content").click();await page.getByLabel(text("contentTitle"),{exact:true}).fill("رسالة تجريبية جديدة");
  await button(page,"save").click();await page.locator("header").getByRole("link",{name:"MEENDOC",exact:true}).click();
  await expect(page.locator(".announcement")).toHaveText("رسالة تجريبية جديدة");
});

test("OTP accepts Arabic digits and account privacy clearing removes session data",async({page})=>{
  await page.goto("/register");
  await page.getByLabel(text("patientName"),{exact:true}).fill("زائر خيالي");
  await page.getByLabel(text("phone"),{exact:true}).fill("٠١٠١٢٣٤٥٦٧٨");
  await page.getByLabel(text("password"),{exact:true}).fill("demo-only");
  await button(page,"sendCode").click();await page.getByLabel(text("otp"),{exact:true}).fill("١٢٣٤٥٦");
  await button(page,"verify").click();await expect(page).toHaveURL(/account/);
  await page.getByRole("combobox",{name:text("preferredLocation"),exact:true}).selectOption("cairo");
  await page.getByLabel(text("reminders"),{exact:true}).check();
  await button(page,"clearData").click();
  await page.getByRole("dialog").getByRole("button",{name:text("clearData"),exact:true}).click();
  await expect(page.locator(".account-sidebar h2")).toHaveText(text("guest"));
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem("meendoc.demo.preferences.v1")||"{}"));
  expect(data.favorites).toEqual([]);expect(data.location).toBe("all");expect(data.reminders).toBe(false);
});

test("doctor schedule edits reach profiles and password recovery stays a demonstration",async({page})=>{
  await page.goto("/doctor/dashboard");
  await page.getByLabel(text("fee"),{exact:true}).fill("520");
  await button(page,"save").click();
  await page.getByRole("tab",{name:text("availability"),exact:true}).click();
  await page.getByLabel(text("time"),{exact:true}).fill("13:15");
  await button(page,"addSlot").click();
  await expect(page.locator(".slot-editor")).toContainText(formatTime("13:15","ar"));
  await page.locator("header").getByRole("link",{name:text("doctors"),exact:true}).click();
  await page.locator('.doctor-card[data-doctor-id="doctor-1"] .doctor-name').click();
  await expect(page.locator(".appointment-card .booking-price")).toContainText("٥٢٠");
  await expect(page.locator(".time-slots")).toContainText(formatTime("13:15","ar"));
  await page.locator("footer").getByRole("link",{name:text("doctorDashboard"),exact:true}).click();
  await page.getByRole("tab",{name:text("availability"),exact:true}).click();
  await page.getByRole("button",{name:text("remove")+" "+formatTime("13:15","ar"),exact:true}).click();
  await expect(page.locator(".slot-editor")).not.toContainText(formatTime("13:15","ar"));
  await page.goto("/forgot-password");
  await page.getByLabel(text("phone"),{exact:true}).fill("01012345678");
  await button(page,"next").click();
  await expect(page.locator(".auth-success")).toContainText(text("forgotDone"));
  await page.locator(".auth-success").getByRole("button",{name:text("login"),exact:true}).click();
  await expect(page.getByRole("heading",{name:text("loginTitle"),exact:true})).toBeVisible();
});

for(const lang of ["ar","en"] as const) {
  test("responsive layouts, local assets and runtime health — "+lang,async({page})=>{
    test.setTimeout(240000);
    const errors:string[]=[],failedAssets:string[]=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("response",response=>{if(response.status()>=400&&/fonts|images/.test(response.url()))failedAssets.push(response.url());});
    await page.goto("/");await setLanguage(page,lang);
    fs.mkdirSync("artifacts/qa",{recursive:true});
    for(const width of [320,360,390,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      for(const route of ["/","/doctors","/doctors/doctor-1","/booking/doctor-1","/join-as-doctor","/admin"]) {
        await page.goto(route);await expect(page.getByRole("heading",{level:1})).toBeVisible();
        await page.evaluate(()=>document.fonts.ready);
        const metrics=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
        expect(metrics.scroll,"overflow at "+route+" "+width+" "+lang).toBeLessThanOrEqual(metrics.client+1);
        await expect(page.locator("html")).toHaveAttribute("dir",lang==="ar"?"rtl":"ltr");
        if(route==="/"&&(width===390||width===1440))await page.screenshot({path:"artifacts/qa/home-"+lang+"-"+width+".png",fullPage:true});
        if(route==="/doctors"&&width===1440)await page.screenshot({path:"artifacts/qa/doctors-"+lang+"-1440.png",fullPage:true});
      }
    }
    expect(errors).toEqual([]);expect(failedAssets).toEqual([]);
  });
}
