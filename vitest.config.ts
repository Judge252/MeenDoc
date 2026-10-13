import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({resolve:{alias:{"@":path.resolve("src"),"server-only":path.resolve("tests/unit/server-only.ts")}},test:{include:["tests/unit/**/*.test.ts"],testTimeout:30000,hookTimeout:60000,pool:"forks",maxWorkers:1}});
