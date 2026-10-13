import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { translate } from "../src/lib/i18n";
for(const lang of ["ar","en"] as const) {
  test("automated accessibility on patient and management routes — "+lang,async({page})=>{
    test.setTimeout(240000);
    await page.goto("/");
    if(lang==="en")await page.locator("header").getByRole("button",{name:"تغيير اللغة"}).click();
    await expect(page.locator("html")).toHaveAttribute("dir",lang==="ar"?"rtl":"ltr");
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("meendoc.demo.preferences.v1")||"{}").lang)).toBe(lang);
    for(const width of [360,1440]) {
      await page.setViewportSize({width,height:900});
      for(const route of ["/","/doctors","/doctors/doctor-1","/booking/doctor-1","/login","/join-as-doctor","/admin"]) {
        await page.goto(route);
        await expect(page.locator("html")).toHaveAttribute("dir",lang==="ar"?"rtl":"ltr");
        await expect(page.getByRole("heading",{level:1})).toBeVisible();
        await page.evaluate(()=>document.fonts.ready);
        const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
        expect(results.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),route+" "+width+" "+lang).toEqual([]);
      }
    }
  });
}
test("keyboard can open, traverse and close the voice dialog",async({page})=>{
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link",{name:translate("skip","ar"),exact:true})).toBeFocused();
  const voice=page.getByRole("button",{name:translate("voice","ar"),exact:true});
  await voice.focus();await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  for(let i=0;i<7;i++){
    await page.keyboard.press("Tab");
    expect(await page.getByRole("dialog").evaluate(dialog=>dialog.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(voice).toBeFocused();
});
