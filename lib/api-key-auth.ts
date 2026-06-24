import { redis } from "@/lib/redis";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";
const DEMO_EMAIL = "leonidfedorets30@gmail.com";

export async function verifyApiKey(req: Request): Promise<{ tid: string; email: string } | null> {
  try {
    const key = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    if (!key || !key.startsWith("uth_live_")) return null;
    const stored = await redis.get(`tenant:apikey:${DEMO_TID}`);
    if (!stored || stored !== key) return null;
    return { tid: DEMO_TID, email: DEMO_EMAIL };
  } catch {
    return null;
  }
}
