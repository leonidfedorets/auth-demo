import { createHash } from "crypto";
import { redis } from "@/lib/redis";

const DEMO_TID = "c7ed9c17-0633-49df-9bc7-81de55f69fb7";

export interface ApiKeyContext {
  tid: string;
  appId?: string;
  appName?: string;
  email?: string;
}

export async function verifyApiKey(req: Request): Promise<ApiKeyContext | null> {
  try {
    const key = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    if (!key || !key.startsWith("uth_live_")) return null;

    // New app-level key lookup
    const hash = createHash("sha256").update(key).digest("hex");
    const meta = await redis.get<{ tid: string; appId: string; appName: string; revokedAt?: string }>(`app:apikey:lookup:${hash}`);
    if (meta && !meta.revokedAt) {
      const stored = await redis.get<string>(`app:apikey:${meta.appId}`);
      if (stored === key) return { tid: meta.tid, appId: meta.appId, appName: meta.appName };
    }

    // Legacy: per-tenant key
    const stored = await redis.get<string>(`tenant:apikey:${DEMO_TID}`);
    if (stored === key) return { tid: DEMO_TID, email: "leonidfedorets30@gmail.com" };

    return null;
  } catch {
    return null;
  }
}
