import { defineConfig } from "@playwright/test";
const testURL=process.env.MEENDOC_TEST_URL||"http://127.0.0.1:3100";
export default defineConfig({
  testDir:"./tests",testMatch:"**/*.spec.ts",fullyParallel:false,workers:1,timeout:90000,
  expect:{timeout:10000},reporter:[["list"],["html",{open:"never"}]],
  use:{baseURL:testURL,viewport:{width:1440,height:1000},actionTimeout:15000,
    launchOptions:{executablePath:process.env.MEENDOC_TEST_BROWSER||undefined},
    screenshot:"only-on-failure",trace:"retain-on-failure"},
  webServer:process.env.MEENDOC_TEST_URL?undefined:{command:"npx next dev --hostname 127.0.0.1 --port 3100",url:testURL,reuseExistingServer:false,timeout:120000,env:{APP_MODE:"offline",LIVE_AI_ENABLED:"false",MEENDOC_TEST_SERVER:"true",NEXT_PUBLIC_APP_URL:testURL}},
});
