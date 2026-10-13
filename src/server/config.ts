import "server-only";
import { z } from "zod";
const flag = z.enum(["true","false"]).transform(v=>v==="true");
const schema = z.object({
  APP_MODE:z.enum(["demo","offline"]).default("offline"),
  DEMO_SAFE_MODE:flag.default(true),
  NEXT_PUBLIC_APP_URL:z.url().default("http://127.0.0.1:3000"),
  NEXT_PUBLIC_SUPABASE_URL:z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:z.string().min(10).optional(),
  SUPABASE_SERVICE_ROLE_KEY:z.string().min(20).optional(),
  SUPABASE_SECRET_KEY:z.string().min(20).optional(),
  GEMINI_API_KEY:z.string().min(10).optional(),
  GEMINI_MODEL:z.string().regex(/^gemini-[a-z0-9.-]+$/).default("gemini-3.5-flash-lite"),
  LIVE_AI_ENABLED:flag.default(false),
  GEMINI_TIMEOUT_MS:z.coerce.number().int().min(1000).max(30000).default(15000),
  AI_REQUEST_LIMIT_PER_HOUR:z.coerce.number().int().min(1).max(100).default(20),
  AI_DAILY_USAGE_LIMIT:z.coerce.number().int().min(1).max(10000).default(200),
  AI_MAX_OUTPUT_TOKENS:z.coerce.number().int().min(100).max(1500).default(700),
  AI_MAX_HISTORY_MESSAGES:z.coerce.number().int().min(2).max(16).default(12),
  AI_MAX_CONTEXT_CHARACTERS:z.coerce.number().int().min(1000).max(16000).default(12000),
  BOOKING_WINDOW_DAYS:z.coerce.number().int().min(1).max(30).default(14),
  RATE_LIMIT_SECRET:z.string().min(32).optional(),
  CRON_SECRET:z.string().min(32).optional(),
});
export function configuration(){
  const result=schema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([,v])=>v!=="")));
  if(!result.success)throw new Error("INVALID_SERVER_CONFIGURATION");
  if(!result.data.DEMO_SAFE_MODE)throw new Error("DEMO_SAFE_MODE_REQUIRED");
  return result.data;
}
export function databaseConfigured(){const c=configuration();return Boolean(c.NEXT_PUBLIC_SUPABASE_URL&&c.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);}
export function privilegedKey(){const c=configuration();return c.SUPABASE_SECRET_KEY||c.SUPABASE_SERVICE_ROLE_KEY;}
