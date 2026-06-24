import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiters
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "rl:login",
});

export const registerRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "60 s"),
  prefix: "rl:register",
});

export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "60 s"),
  prefix: "rl:api",
});

// Session cache
export async function cacheSession(sessionId: string, data: object, ttlSeconds: number) {
  await redis.set(`sess:${sessionId}`, JSON.stringify(data), { ex: ttlSeconds });
}

export async function getSession(sessionId: string) {
  const raw = await redis.get(`sess:${sessionId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function deleteSession(sessionId: string) {
  await redis.del(`sess:${sessionId}`);
}

// Failed login tracking
export async function incrementFailedLogins(ip: string): Promise<number> {
  const key = `failed:${ip}`;
  const count = await redis.incr(key);
  await redis.expire(key, 600); // 10 minute window
  return count;
}

export async function resetFailedLogins(ip: string) {
  await redis.del(`failed:${ip}`);
}

export async function getFailedLogins(ip: string): Promise<number> {
  return (await redis.get<number>(`failed:${ip}`)) ?? 0;
}

// WebAuthn challenge store
export async function storeWebAuthnChallenge(userId: string, challenge: string, type: string) {
  await redis.set(`wa:challenge:${userId}:${type}`, challenge, { ex: 300 });
}

export async function getWebAuthnChallenge(userId: string, type: string): Promise<string | null> {
  return redis.get(`wa:challenge:${userId}:${type}`);
}

export async function deleteWebAuthnChallenge(userId: string, type: string) {
  await redis.del(`wa:challenge:${userId}:${type}`);
}

// SCA OTP store
export async function storeSCACode(challengeId: string, codeHash: string) {
  await redis.set(`sca:${challengeId}`, codeHash, { ex: 300 });
}

export async function getSCACode(challengeId: string): Promise<string | null> {
  return redis.get(`sca:${challengeId}`);
}
